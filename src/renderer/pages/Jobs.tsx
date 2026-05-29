// /jobs — generation jobs page. Two sections:
//   1. Active + recently-finished in-memory jobs (from useJobsStore).
//      Active jobs show a live progress bar with a cancel button.
//   2. Historical batches from the SQLite `generations` table — every batch
//      the user has ever generated, scoped to the active company.
//
// Designed so the user can kick off a generation, navigate away, and come
// back here to see what's still running and what just finished — alongside
// the long-term archive.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconWand,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconFolder,
  IconClock,
  IconFiles,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useJobsStore, type Job } from '../stores/jobsStore';
import { useCompanyStore } from '../stores/companyStore';

type Batch = Awaited<ReturnType<typeof window.api.generations.listBatches>>[number];

export default function Jobs() {
  const navigate = useNavigate();
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  // CRITICAL: subscribe to the raw `jobs` record (object reference is stable
  // between updates) and compute the sorted list in a useMemo. A selector
  // like `(s) => s.list()` returns a fresh array on every call and trips
  // Zustand's Object.is equality check, causing an infinite re-render loop
  // and a blank page.
  const jobsMap = useJobsStore((s) => s.jobs);
  const jobs = useMemo(
    () =>
      Object.values(jobsMap).sort((a, b) => {
        if (a.status === 'running' && b.status !== 'running') return -1;
        if (b.status === 'running' && a.status !== 'running') return 1;
        return b.startedAt - a.startedAt;
      }),
    [jobsMap],
  );
  const cancel = useJobsStore((s) => s.cancel);
  const dismiss = useJobsStore((s) => s.dismiss);
  const clearCompleted = useJobsStore((s) => s.clearCompleted);

  const [history, setHistory] = useState<Batch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // History refreshes on company switch + after any in-memory job completes,
  // so a fresh batch shows up in the list without a manual reload.
  const completedCount = jobs.filter((j) => j.status !== 'running').length;
  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    void window.api.generations
      .listBatches(activeCompanyId ?? undefined, 100)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, completedCount]);

  const runningJobs = jobs.filter((j) => j.status === 'running');
  const finishedJobs = jobs.filter((j) => j.status !== 'running');

  return (
    <Page
      title="Jobs"
      actions={
        <Button size="sm" variant="primary" onClick={() => navigate('/generate')}>
          <IconWand size={14} /> Start a generation
        </Button>
      }
    >
      {jobs.length === 0 && history.length === 0 && !loadingHistory && (
        <EmptyState
          onStart={() => navigate('/generate')}
        />
      )}

      {runningJobs.length > 0 && (
        <Section title={`Running (${runningJobs.length})`}>
          <div className="space-y-2">
            {runningJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onCancel={() => cancel(job.id)}
                onDismiss={() => dismiss(job.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {finishedJobs.length > 0 && (
        <Section
          title={`This session (${finishedJobs.length})`}
          action={
            <button
              onClick={clearCompleted}
              className="text-xs text-fg-muted hover:text-fg-base"
            >
              Clear
            </button>
          }
        >
          <div className="space-y-2">
            {finishedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onCancel={() => cancel(job.id)}
                onDismiss={() => dismiss(job.id)}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="History">
        {loadingHistory ? (
          <div className="px-2 py-6 text-sm text-fg-muted">Loading…</div>
        ) : history.length === 0 ? (
          <div className="px-2 py-6 text-sm text-fg-muted">
            No generation batches yet for this workspace.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border-base">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated text-left text-xs uppercase tracking-wide text-fg-subtle">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Brand</th>
                  <th className="px-3 py-2 font-medium">Sizes</th>
                  <th className="px-3 py-2 font-medium">Formats</th>
                  <th className="px-3 py-2 text-right font-medium">SKUs</th>
                  <th className="px-3 py-2 text-right font-medium">Files</th>
                  <th className="px-3 py-2 text-right font-medium">Size</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((batch) => (
                  <BatchRow key={batch.batchId} batch={batch} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Page>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
      <IconWand size={28} className="mx-auto mb-3 text-fg-subtle" />
      <div className="text-sm text-fg-base">No generation jobs yet.</div>
      <div className="mt-1 text-xs text-fg-muted">
        Start a generation and you'll be able to keep working while it runs in
        the background.
      </div>
      <div className="mt-4">
        <Button variant="primary" size="sm" onClick={onStart}>
          <IconWand size={14} /> Start a generation
        </Button>
      </div>
    </div>
  );
}

function JobCard({
  job,
  onCancel,
  onDismiss,
}: {
  job: Job;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const done = job.progress?.index ?? job.summary?.generated ?? 0;
  const pct = job.total > 0 ? Math.round((done / job.total) * 100) : 0;
  const elapsed = (job.finishedAt ?? Date.now()) - job.startedAt;
  const rate = elapsed > 0 ? done / (elapsed / 1000) : 0;
  const remaining =
    job.status === 'running' && rate > 0
      ? Math.round((job.total - done) / rate)
      : 0;

  const StatusBadge = () => {
    switch (job.status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
            <Spinner /> Running
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
            <IconCheck size={10} /> Done
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
            Cancelled
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-2 py-0.5 text-[10px] font-medium text-danger">
            <IconAlertCircle size={10} /> Failed
          </span>
        );
    }
  };

  return (
    <div className="rounded-md border border-border-base bg-bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-fg-base">
            <span className="truncate">{job.brandName}</span>
            <span className="text-fg-subtle">·</span>
            <span className="truncate text-fg-muted">{job.templateName}</span>
            <StatusBadge />
          </div>
          <div className="mt-0.5 text-xs text-fg-muted">
            {done}/{job.total} {job.total === 1 ? 'label' : 'labels'}
            {job.progress?.sku && job.status === 'running' && (
              <>
                {' · '}
                <code className="rounded bg-bg-elevated px-1 text-[10px]">
                  {job.progress.sku}
                </code>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {job.status === 'running' && (
            <Button size="sm" variant="ghost" onClick={onCancel} title="Cancel">
              <IconX size={12} /> Cancel
            </Button>
          )}
          {job.status !== 'running' && job.summary && job.summary.outputDir && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                window.api.export.revealInFinder(job.summary!.outputDir)
              }
              title="Open output folder"
            >
              <IconFolder size={12} /> Open folder
            </Button>
          )}
          {job.status !== 'running' && (
            <button
              onClick={onDismiss}
              title="Dismiss"
              className="rounded p-1 text-fg-muted hover:text-fg-base"
            >
              <IconX size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={[
            'h-full transition-[width] duration-200',
            job.status === 'running'
              ? 'bg-accent'
              : job.status === 'completed'
                ? 'bg-success'
                : job.status === 'failed'
                  ? 'bg-danger'
                  : 'bg-warning',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[10px] text-fg-subtle">
        <span>
          <IconClock size={10} className="-mt-0.5 mr-0.5 inline" />
          {formatDuration(elapsed)}
        </span>
        <span>{rate ? `${rate.toFixed(1)}/s` : ''}</span>
        <span>
          {remaining ? `${formatDuration(remaining * 1000)} left` : ''}
        </span>
      </div>

      {job.summary?.errors && job.summary.errors.length > 0 && (
        <details className="mt-2 text-xs text-fg-muted">
          <summary className="cursor-pointer text-warning">
            {job.summary.errors.length} warning
            {job.summary.errors.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1.5 max-h-32 overflow-y-auto rounded border border-border-subtle p-2 font-mono text-[10px]">
            {job.summary.errors.slice(0, 50).map((e, i) => (
              <li key={i} className="truncate">
                {e}
              </li>
            ))}
          </ul>
        </details>
      )}

      {job.error && (
        <div className="mt-2 rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
          {job.error}
        </div>
      )}
    </div>
  );
}

function BatchRow({ batch }: { batch: Batch }) {
  return (
    <tr className="border-t border-border-subtle text-fg-base">
      <td className="px-3 py-2 text-xs text-fg-muted" title={batch.startedAt}>
        {formatRelative(batch.finishedAt)}
      </td>
      <td className="px-3 py-2 text-sm">{batch.brandName ?? '—'}</td>
      <td className="px-3 py-2 text-xs">
        {batch.sizeLabels.join(', ') || '—'}
      </td>
      <td className="px-3 py-2 text-xs uppercase">
        {batch.formats.join(', ') || '—'}
      </td>
      <td className="px-3 py-2 text-right text-sm">{batch.skuCount}</td>
      <td className="px-3 py-2 text-right text-sm">
        <span className="inline-flex items-center gap-1">
          <IconFiles size={10} className="text-fg-subtle" />
          {batch.fileCount}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-xs text-fg-muted">
        {batch.totalBytes != null ? formatBytes(batch.totalBytes) : '—'}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          className="rounded px-2 py-1 text-[10px] font-medium text-fg-muted hover:bg-bg-hover hover:text-fg-base"
          onClick={() =>
            // Reuse the File Manager's per-batch filter via the URL.
            (window.location.hash = `#/files?batch=${encodeURIComponent(batch.batchId)}`)
          }
          title="See files from this batch in File Manager"
        >
          View files →
        </button>
      </td>
    </tr>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-fg-base">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
  );
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}m ${s % 60}s`;
  return `${h}h ${m % 60}m`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
