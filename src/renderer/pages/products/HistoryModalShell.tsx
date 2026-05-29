// Modal shell around the existing <ImportHistory> view. Image Studio KH
// has no tabs on its Library page; surfaces like "past imports" live
// elsewhere (Settings or modals). We split the difference: still expose
// import history, but as a modal opened from the Library toolbar.

import { useEffect, useRef } from 'react';
import { IconX } from '@tabler/icons-react';
import { ImportHistory } from '../dataImport/ImportHistory';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HistoryModalShell({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border-base bg-bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
          <h3
            id="history-modal-title"
            className="text-sm font-semibold text-fg-base"
          >
            Import history
          </h3>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close (Esc)"
            title="Close (Esc)"
            className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-base"
          >
            <IconX size={16} />
          </button>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ImportHistory />
        </div>
      </div>
    </div>
  );
}
