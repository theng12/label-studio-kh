// Background-generation jobs store. Owns the lifecycle of a bulk export
// from kickoff through completion so the Generate page can fire-and-forget:
// user can navigate away, kick off another job, or quit and come back to
// the Jobs page to see the result.
//
// State model:
//   - `jobs` is keyed by runId; each entry tracks progress + final summary.
//   - Running jobs hold a live IPC progress subscription (closed on finish).
//   - Finished jobs stay in memory until the user dismisses them or the app
//     reloads — historical batches live in the SQLite `generations` table
//     and are surfaced separately on the Jobs page.
//
// On completion the store fires a toast and, when the window is unfocused,
// a native OS notification — so the user knows even if they switched apps.

import { create } from 'zustand';
import type { Template } from '../../shared/types/template';
import type { Brand } from '../../shared/types/brand';
import type {
  BulkExportSummary,
  ExportProgressInfo,
  ExportSettings,
} from '../../preload/index';
import { toast } from '../components/Toast';

export type JobStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export interface Job {
  id: string; // runId / batchId
  brandName: string;
  templateName: string;
  total: number;
  /** Latest progress info from the IPC stream; null until first row finishes. */
  progress: ExportProgressInfo | null;
  /** Final summary when status moves to completed/cancelled/failed. */
  summary: BulkExportSummary | null;
  outputDir: string;
  status: JobStatus;
  startedAt: number;
  finishedAt: number | null;
  /** Free-text error message when status === 'failed'. */
  error?: string;
}

export interface StartJobInput {
  template: Template;
  brand: Brand | null;
  rows: Record<string, string>[];
  settings: ExportSettings;
}

interface JobsStore {
  jobs: Record<string, Job>;
  /** Convenience selectors derived from `jobs`. */
  runningCount(): number;
  list(): Job[];

  /** Kick off a bulk export. Returns the new runId so callers can navigate. */
  start(input: StartJobInput): Promise<string>;
  /** Ask the main process to cancel a running job. The IPC `bulk` promise
   *  resolves with the partial summary; the job lands in 'cancelled' state. */
  cancel(runId: string): Promise<void>;
  /** Remove a finished job from the in-memory list (UI dismissal only;
   *  the DB rows in `generations` are untouched). */
  dismiss(runId: string): void;
  /** Wipe everything that isn't running. */
  clearCompleted(): void;
}

// Module-level map of unsubscribe handles for active progress listeners.
// Lives outside the store so re-renders don't churn it.
const offHandles = new Map<string, () => void>();

function nativeNotify(title: string, body: string): void {
  // Renderer can fire HTML5 Notifications directly — Electron exposes them
  // without a permission prompt. Skip when the window already has focus so
  // we don't double up on the in-app toast.
  if (typeof Notification === 'undefined') return;
  if (document.hasFocus()) return;
  try {
    new Notification(title, { body, silent: false });
  } catch {
    // Some platforms throw if user has disabled notifications system-wide;
    // we already showed the toast, so just swallow.
  }
}

export const useJobsStore = create<JobsStore>((set, get) => ({
  jobs: {},

  runningCount() {
    return Object.values(get().jobs).filter((j) => j.status === 'running').length;
  },

  list() {
    // Newest first; running jobs always bubble to the top.
    return Object.values(get().jobs).sort((a, b) => {
      if (a.status === 'running' && b.status !== 'running') return -1;
      if (b.status === 'running' && a.status !== 'running') return 1;
      return b.startedAt - a.startedAt;
    });
  },

  async start(input) {
    const runId = crypto.randomUUID();
    const job: Job = {
      id: runId,
      brandName: input.brand?.name ?? '—',
      templateName: input.template.name,
      total: input.rows.length,
      progress: null,
      summary: null,
      outputDir: input.settings.outputDir,
      status: 'running',
      startedAt: Date.now(),
      finishedAt: null,
    };
    set((s) => ({ jobs: { ...s.jobs, [runId]: job } }));

    // Subscribe to progress events for this run. Stored in the module-level
    // map so cancel/finish can clean it up.
    const off = window.api.export.onProgress(runId, (info) => {
      set((s) => {
        const existing = s.jobs[runId];
        if (!existing) return s;
        return { jobs: { ...s.jobs, [runId]: { ...existing, progress: info } } };
      });
    });
    offHandles.set(runId, off);

    // Kick off the bulk export and resolve when it finishes. We deliberately
    // don't await this in the caller — the page should be free to navigate.
    void (async () => {
      try {
        const summary = await window.api.export.bulk({
          runId,
          template: input.template,
          brand: input.brand,
          rows: input.rows,
          settings: input.settings,
        });
        // The pipeline reports cancellation by returning a partial summary
        // where `generated < total`; we can't distinguish "cancelled" from
        // "errored mid-flight" without an explicit signal. For now we surface
        // it as completed unless start-via-cancel set it; the renderer can
        // refine later.
        const wasCancelled = get().jobs[runId]?.status === 'cancelled';
        set((s) => {
          const existing = s.jobs[runId];
          if (!existing) return s;
          return {
            jobs: {
              ...s.jobs,
              [runId]: {
                ...existing,
                summary,
                status: wasCancelled ? 'cancelled' : 'completed',
                finishedAt: Date.now(),
              },
            },
          };
        });

        const label = `${summary.generated}/${summary.total} label${summary.total === 1 ? '' : 's'} generated`;
        if (wasCancelled) {
          toast.info(`Generation cancelled — ${label}`);
        } else if (summary.errors.length > 0) {
          toast.info(`${label} (${summary.errors.length} warning${summary.errors.length === 1 ? '' : 's'})`);
          nativeNotify(
            `Label Studio KH — generation done`,
            `${label} with ${summary.errors.length} warnings. Open the Jobs page for details.`,
          );
        } else {
          toast.success(`${label} — done.`, {
            action: {
              label: 'Open folder',
              onClick: () => void window.api.export.revealInFinder(summary.outputDir),
            },
          });
          nativeNotify(
            `Label Studio KH — generation done`,
            `${label}. Saved to ${summary.outputDir}.`,
          );
        }
      } catch (err) {
        set((s) => {
          const existing = s.jobs[runId];
          if (!existing) return s;
          return {
            jobs: {
              ...s.jobs,
              [runId]: {
                ...existing,
                status: 'failed',
                error: String(err),
                finishedAt: Date.now(),
              },
            },
          };
        });
        toast.error(`Generation failed: ${err}`);
      } finally {
        const cleanup = offHandles.get(runId);
        cleanup?.();
        offHandles.delete(runId);
      }
    })();

    return runId;
  },

  async cancel(runId) {
    // Mark cancelled-intent locally first so the resolution path knows.
    set((s) => {
      const existing = s.jobs[runId];
      if (!existing || existing.status !== 'running') return s;
      return { jobs: { ...s.jobs, [runId]: { ...existing, status: 'cancelled' } } };
    });
    try {
      await window.api.export.cancel(runId);
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  },

  dismiss(runId) {
    set((s) => {
      const existing = s.jobs[runId];
      if (!existing || existing.status === 'running') return s; // never drop running
      const next = { ...s.jobs };
      delete next[runId];
      return { jobs: next };
    });
  },

  clearCompleted() {
    set((s) => {
      const next: Record<string, Job> = {};
      for (const [id, job] of Object.entries(s.jobs)) {
        if (job.status === 'running') next[id] = job;
      }
      return { jobs: next };
    });
  },
}));
