import { useEffect, useRef, useState } from 'react';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';
import {
  FILENAME_PRESETS,
  TOKENS_HELP,
  type FilenamePreset,
} from '../../shared/filenamePatterns';

/**
 * Free-text input for the filename pattern, paired with a dropdown of common
 * preset patterns. Picking a preset overwrites the input; the user can still
 * type freely. Used by both the Generate page and the Settings page.
 */
export function FilenamePatternInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const matched: FilenamePreset | undefined = FILENAME_PRESETS.find(
    (p) => p.pattern === value,
  );

  return (
    <div ref={ref} className={['relative', className ?? ''].join(' ')}>
      <div className="flex">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="flex-1 rounded-l-md border border-r-0 border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          placeholder={TOKENS_HELP}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Pick a preset filename pattern"
          className="flex items-center gap-1 rounded-r-md border border-border-base bg-bg-elevated px-2 text-xs text-fg-muted hover:bg-bg-hover hover:text-fg-base"
        >
          Presets <IconChevronDown size={12} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[420px] max-w-[calc(100vw-2rem)] rounded-md border border-border-base bg-bg-surface p-1 shadow-xl">
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
            Common patterns
          </div>
          <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
            {FILENAME_PRESETS.map((p) => {
              const active = matched && matched.pattern === p.pattern;
              return (
                <button
                  key={p.pattern}
                  onClick={() => {
                    onChange(p.pattern);
                    setOpen(false);
                  }}
                  className={[
                    'flex w-full flex-col items-start gap-0.5 rounded px-2 py-2 text-left text-xs transition-colors',
                    active
                      ? 'bg-accent/10 text-fg-base'
                      : 'text-fg-base hover:bg-bg-hover',
                  ].join(' ')}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="font-medium">{p.label}</span>
                    {active && <IconCheck size={12} className="text-accent" />}
                  </span>
                  <code className="text-[11px] text-fg-muted">{p.pattern}</code>
                  <span className="text-[10px] text-fg-subtle">
                    e.g. {p.example}
                  </span>
                  {p.description && (
                    <span className="mt-0.5 text-[10px] text-fg-subtle">
                      {p.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border-subtle px-2 py-1.5 text-[10px] text-fg-subtle">
            Tokens: <code>{TOKENS_HELP}</code>
          </div>
        </div>
      )}
    </div>
  );
}
