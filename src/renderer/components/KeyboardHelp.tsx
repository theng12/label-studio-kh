import { useEffect, useState } from 'react';

const isMac =
  typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
const MOD = isMac ? '⌘' : 'Ctrl';

interface Shortcut {
  keys: string[];
  description: string;
}

interface Section {
  title: string;
  shortcuts: Shortcut[];
}

const SECTIONS: Section[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['?'], description: 'Open this shortcuts help' },
      { keys: ['Esc'], description: 'Close dialogs and menus' },
    ],
  },
  {
    title: 'Designer',
    shortcuts: [
      { keys: [`${MOD}+S`], description: 'Save template' },
      { keys: [`${MOD}+Z`], description: 'Undo' },
      { keys: [`${MOD}+Shift+Z`, `${MOD}+Y`], description: 'Redo' },
      { keys: [`${MOD}+D`], description: 'Duplicate selected element(s)' },
      { keys: ['Delete', 'Backspace'], description: 'Remove selected element(s)' },
      { keys: ['←', '→', '↑', '↓'], description: 'Nudge selection by 1 mm' },
      { keys: ['Shift+arrow'], description: 'Nudge selection by 0.1 mm (fine)' },
      { keys: [`${MOD}+scroll`], description: 'Zoom canvas in/out' },
      { keys: ['Right-click'], description: 'Open element context menu' },
      { keys: ['Drag empty canvas'], description: 'Marquee-select elements' },
      { keys: ['Shift+drag empty canvas'], description: 'Add to current selection' },
    ],
  },
  {
    title: 'Layers panel',
    shortcuts: [
      { keys: ['Drag row'], description: 'Reorder layers' },
      { keys: ['↑', '↓ buttons'], description: 'Reorder selected layer one step' },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border-subtle bg-bg-elevated px-1.5 py-0.5 text-xs font-mono text-fg-base">
      {children}
    </span>
  );
}

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        return;
      }
      if (e.key !== '?') return;
      const t = document.activeElement as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      e.preventDefault();
      setOpen((v) => !v);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kbd-help-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border-base bg-bg-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="kbd-help-title" className="text-sm font-semibold text-fg-base">
            Keyboard shortcuts
          </h3>
          <span className="text-xs text-fg-muted">
            Press <Kbd>?</Kbd> to toggle
          </span>
        </div>
        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {section.title}
              </h4>
              <ul className="space-y-1.5">
                {section.shortcuts.map((s) => (
                  <li
                    key={s.description}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <span className="text-fg-base">{s.description}</span>
                    <span className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
                      {s.keys.map((k, i) => (
                        <span key={k} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-xs text-fg-subtle">or</span>
                          )}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
