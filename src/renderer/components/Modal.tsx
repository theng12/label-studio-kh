// Shared modal shell. Per AGENTS.md §2:
//   - Esc closes
//   - Clicking the dim backdrop closes
//   - X button in the corner closes (aria-label="Close (Esc)")
//   - Focus moves inside the modal on open
//
// The close logic lives once here; every modal in the app should use this
// wrapper instead of re-implementing the backdrop + Esc dance. Keep the
// surface small: a title, body, optional footer, optional max-width
// preset. Anything richer (multi-pane, tabbed) composes inside the body.

import { useEffect, useRef, type ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';

const WIDTH_CLASS: Record<NonNullable<Props['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

interface Props {
  /** Render gate. Component returns null when false so callers can keep
   *  the JSX mounted without conditional rendering. */
  open: boolean;
  title?: string;
  children: ReactNode;
  /** Right-aligned action row in the modal footer (Cancel + primary
   *  CTA, typically). Omit for modals that have no destructive
   *  CTA — e.g. a pure info panel. */
  footer?: ReactNode;
  /** Tailwind max-w preset for the modal box. Defaults to `md`. */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Disable backdrop-click-to-close. Use sparingly — only for
   *  destructive confirmations where an accidental click would
   *  cancel an irreversible action. */
  closeOnBackdrop?: boolean;
  onClose: () => void;
}

export function Modal({
  open,
  title,
  children,
  footer,
  maxWidth = 'md',
  closeOnBackdrop = true,
  onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Esc-to-close + initial focus management. Focus the close button on
  // open so keyboard users immediately have something tabable inside the
  // modal (matches AGENTS.md §2). Esc handler is bound at the window
  // level so it works regardless of which child currently owns focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    // Defer focus by a tick so the modal is fully mounted before we
    // try to move focus into it (avoids race with parent unmounts).
    const id = window.setTimeout(() => {
      // Prefer the first focusable child inside the body; fall back to
      // the close button if nothing else takes focus.
      const firstInput = containerRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button:not([data-modal-close])',
      );
      (firstInput ?? closeButtonRef.current)?.focus();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(id);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className={[
          'w-full overflow-hidden rounded-lg border border-border-base bg-bg-surface shadow-2xl',
          WIDTH_CLASS[maxWidth],
        ].join(' ')}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
            <h3 id="modal-title" className="text-sm font-semibold text-fg-base">
              {title}
            </h3>
            <button
              ref={closeButtonRef}
              data-modal-close
              onClick={onClose}
              aria-label="Close (Esc)"
              title="Close (Esc)"
              className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-base"
            >
              <IconX size={16} />
            </button>
          </div>
        )}

        <div className="scrollbar-thin max-h-[70vh] overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
