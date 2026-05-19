import { useEffect, useRef, useState } from 'react';
import {
  IconX,
  IconFolder,
  IconCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { Button } from '../../components/Button';
import { toast } from '../../components/Toast';
import { useProductStore } from '../../stores/productStore';

// Three-step folder-import modal — spec §19.
//
//   intro   → rules + "Choose folder" CTA
//   running → spinner while the IPC call resolves
//   results → grid of stat tiles + Done

type Step = 'intro' | 'running' | 'results';

type Stats = Awaited<ReturnType<typeof window.api.products.autoMatchImages>>;

interface Props {
  /** Active company ID. Auto-match scopes to this company's products. */
  companyId: string;
  onClose: () => void;
}

export function AutoMatchModal({ companyId, onClose }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [stats, setStats] = useState<Stats | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const refreshProducts = useProductStore((s) => s.refreshProducts);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'running') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);

  const onPickFolder = async () => {
    const folder = await window.api.products.pickImageFolder();
    if (!folder) return; // user cancelled
    setStep('running');
    try {
      const s = await window.api.products.autoMatchImages(companyId, folder);
      setStats(s);
      setStep('results');
      // Refresh the table so newly-attached images render immediately.
      void refreshProducts();
    } catch (err) {
      toast.error(`Auto-match failed: ${String(err)}`);
      setStep('intro');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="automatch-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && step !== 'running') onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-lg border border-border-base bg-bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
          <h3 id="automatch-title" className="text-sm font-semibold text-fg-base">
            Auto-match product images
          </h3>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close (Esc)"
            disabled={step === 'running'}
            className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-base disabled:opacity-40"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="scrollbar-thin max-h-[70vh] overflow-y-auto px-5 py-4">
          {step === 'intro' && <IntroStep />}
          {step === 'running' && <RunningStep />}
          {step === 'results' && stats && <ResultsStep stats={stats} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">
          {step === 'intro' && (
            <>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void onPickFolder()}>
                <IconFolder size={14} /> Choose folder…
              </Button>
            </>
          )}
          {step === 'running' && (
            <Button variant="secondary" disabled>
              Scanning…
            </Button>
          )}
          {step === 'results' && (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Steps ──────────────────────────────────────────────────────────────────

function IntroStep() {
  return (
    <div className="space-y-3 text-sm text-fg-muted">
      <p>
        Pick a folder of product images. The app will read every image in the
        folder (and its subfolders, up to 5 levels deep) and figure out which
        SKU each one belongs to using these rules:
      </p>
      <ol className="ml-5 list-decimal space-y-2 text-xs">
        <li>
          <strong className="text-fg-base">Filename = SKU.</strong>{' '}
          <code className="rounded bg-bg-elevated px-1 py-px font-mono">
            abc-123.jpg
          </code>{' '}
          → main image for SKU{' '}
          <code className="rounded bg-bg-elevated px-1 py-px font-mono">
            abc-123
          </code>
          . Case-insensitive — <code className="font-mono">ABC-123.JPG</code>{' '}
          works too.
        </li>
        <li>
          <strong className="text-fg-base">Numeric suffix → gallery position.</strong>{' '}
          <code className="font-mono">abc-123-1.jpg</code>,{' '}
          <code className="font-mono">abc-123-2.jpg</code>,{' '}
          <code className="font-mono">abc-123_3.jpg</code>,{' '}
          <code className="font-mono">"abc-123 4.jpg"</code> all attach to the
          same SKU in numeric order. Position 1 becomes the main image.
        </li>
        <li>
          <strong className="text-fg-base">Per-SKU subfolder.</strong> A folder
          named <code className="font-mono">abc-123/</code> with images inside
          attaches all of them to SKU{' '}
          <code className="font-mono">abc-123</code>.{' '}
          <code className="font-mono">main.jpg</code>,{' '}
          <code className="font-mono">primary.jpg</code>, or{' '}
          <code className="font-mono">cover.jpg</code> become the main.
          Numeric names (<code className="font-mono">1.jpg</code>,{' '}
          <code className="font-mono">2.jpg</code>) set the order.
        </li>
        <li>
          <strong className="text-fg-base">Duplicates are detected.</strong>{' '}
          Every image is hashed by content. The same file imported twice
          stores only once and the second copy is reported as "skipped".
        </li>
        <li>
          <strong className="text-fg-base">Existing images stay.</strong>{' '}
          Matched images go to the front of the product's image list (so a{' '}
          <code className="font-mono">-1</code> image becomes the new main).
          Manually-added images that didn't match this run stay at the end.
        </li>
        <li>
          <strong className="text-fg-base">
            Max 20 images per product.
          </strong>{' '}
          Extras are skipped and reported.
        </li>
      </ol>
      <p className="text-xs">
        Unmatched files (e.g. <code className="font-mono">random.jpg</code> at
        the top level) are listed in the results so you know what was ignored.
      </p>
    </div>
  );
}

function RunningStep() {
  return (
    <div className="flex items-center justify-center py-10 text-sm text-fg-muted">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-base border-t-accent" />
        <div className="mt-3">Scanning folder and matching SKUs…</div>
        <div className="mt-1 text-[10px] text-fg-subtle">
          Large folders may take a few seconds.
        </div>
      </div>
    </div>
  );
}

function ResultsStep({ stats }: { stats: Stats }) {
  const matchedPct =
    stats.totalProducts > 0
      ? Math.round((stats.matchedSkus / stats.totalProducts) * 100)
      : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <StatTile label="Files scanned" value={stats.scannedFiles} />
        <StatTile
          label="SKUs matched"
          value={`${stats.matchedSkus} / ${stats.totalProducts}`}
          hint={`${matchedPct}% of catalogue`}
        />
        <StatTile
          label="Images imported"
          value={stats.imagesImported}
          tone="success"
        />
        <StatTile
          label="Duplicates skipped"
          value={stats.imagesSkippedDup}
          tone="muted"
        />
        <StatTile
          label="Unmatched files"
          value={stats.unmatchedFiles}
          tone={stats.unmatchedFiles > 0 ? 'warning' : 'muted'}
        />
        <StatTile
          label="Products updated"
          value={stats.productsTouched}
          tone={stats.productsTouched > 0 ? 'success' : 'muted'}
        />
        {stats.imagesSkippedCap > 0 && (
          <StatTile
            label={`Over the ${stats.maxImagesPerProduct}-image cap`}
            value={stats.imagesSkippedCap}
            tone="warning"
          />
        )}
      </div>

      {stats.unmatchedFiles > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
          <div className="flex items-start gap-2">
            <IconAlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
            <div className="text-fg-base">
              <strong>{stats.unmatchedFiles}</strong> file
              {stats.unmatchedFiles === 1 ? '' : 's'} didn't match any SKU.
              Common reasons: filename doesn't include the SKU, the file
              lives in a subfolder whose name isn't a SKU, or the SKU isn't
              in this company's product list yet.
            </div>
          </div>
        </div>
      )}

      {stats.imagesImported === 0 &&
        stats.imagesSkippedDup === 0 &&
        stats.scannedFiles > 0 && (
          <div className="rounded-md border border-border-subtle bg-bg-elevated p-3 text-xs text-fg-muted">
            Nothing imported. Either the folder has no matching filenames,
            or every file was already attached to its product.
          </div>
        )}

      {stats.imagesImported > 0 && (
        <div className="rounded-md border border-success/40 bg-success/10 p-3 text-xs">
          <div className="flex items-start gap-2">
            <IconCheck size={14} className="mt-0.5 shrink-0 text-success" />
            <div className="text-fg-base">
              Attached <strong>{stats.imagesImported}</strong> image
              {stats.imagesImported === 1 ? '' : 's'} across{' '}
              <strong>{stats.productsTouched}</strong> product
              {stats.productsTouched === 1 ? '' : 's'}. Close this dialog and
              open any product to see them.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'muted';
}) {
  const valueColor =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'muted'
          ? 'text-fg-muted'
          : 'text-fg-base';
  return (
    <div className="rounded-md border border-border-base bg-bg-base p-3">
      <div className="text-[10px] uppercase tracking-widest text-fg-subtle">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${valueColor}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-fg-subtle">{hint}</div>}
    </div>
  );
}
