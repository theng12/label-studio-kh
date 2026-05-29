// Modal shell around the existing 4-step <ImportFlow>. Image Studio KH
// opens its import wizard as a modal from the Library toolbar (not as a
// tab on the page), and this brings Label Studio KH to parity without
// rewriting the wizard internals — the same pickFile → mapAndPreview →
// dedup → done flow ships unchanged, just rendered inside a dialog.
//
// The modal is dismissable via Esc / backdrop / X (per AGENTS.md §2),
// except during the `committing` step where we block dismissal so the
// user doesn't accidentally bail mid-write to SQLite.

import { useEffect, useRef } from 'react';
import { IconX, IconHistory } from '@tabler/icons-react';
import { ImportFlow } from '../dataImport/ImportFlow';
import { useImportStore } from '../../stores/importStore';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional — open the "Recent imports" history modal from inside the
   *  import modal's first step. Passed through to a header link. */
  onOpenHistory?: () => void;
  /** Called when the user clicks "View in Library" on the Done step.
   *  Receives the brand id they imported into. The parent should close
   *  this modal AND apply that brand to the product-library filter. */
  onViewInLibrary?: (brandId: string | null) => void;
}

export function ImportModalShell({
  open,
  onClose,
  onOpenHistory,
  onViewInLibrary,
}: Props) {
  const im = useImportStore();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Block Esc / backdrop close during the committing step — a partial
  // commit could leave the user wondering whether their rows landed.
  const isCommitting = im.step === 'committing';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCommitting) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    // Focus the X button on open for keyboard accessibility.
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isCommitting, onClose]);

  // After the modal closes, reset the wizard back to step 1 so the next
  // open is a fresh import. We do this on the next tick so the close
  // animation (if any) doesn't flash the reset state.
  useEffect(() => {
    if (open || im.step === 'pickFile') return;
    const t = setTimeout(() => im.reset(), 200);
    return () => clearTimeout(t);
  }, [open, im]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isCommitting) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border-base bg-bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
          <h3
            id="import-modal-title"
            className="text-sm font-semibold text-fg-base"
          >
            Import Excel / CSV
          </h3>
          <div className="flex items-center gap-2">
            {/* Recent imports link — opens the history modal alongside
                this one. Only visible on the pickFile step; once the
                user has loaded a workbook, the link would be a distraction. */}
            {onOpenHistory && im.step === 'pickFile' && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-bg-hover hover:text-fg-base"
                title="See past imports for this brand"
              >
                <IconHistory size={12} /> Recent imports →
              </button>
            )}
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Close (Esc)"
              title="Close (Esc)"
              disabled={isCommitting}
              className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-base disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Body — scrollable, fills remaining space. The wizard's own
            internal scrolling is fine; we just need a height budget. */}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ImportFlow onViewInLibrary={onViewInLibrary} />
        </div>
      </div>
    </div>
  );
}
