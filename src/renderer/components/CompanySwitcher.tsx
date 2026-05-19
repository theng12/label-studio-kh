import { useEffect, useRef, useState } from 'react';
import { IconChevronDown, IconCheck, IconBuilding, IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useCompanyStore } from '../stores/companyStore';

// Top-of-sidebar workspace switcher. Shows the active company's name +
// swatch, dropdown lists every company, click to switch. The "Manage
// companies" link at the bottom jumps to /company for renaming, adding,
// or editing price groups.

export function CompanySwitcher() {
  const navigate = useNavigate();
  const companies = useCompanyStore((s) => s.companies);
  const activeId = useCompanyStore((s) => s.activeCompanyId);
  const setActive = useCompanyStore((s) => s.setActive);
  const refresh = useCompanyStore((s) => s.refresh);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const active = companies.find((c) => c.id === activeId) ?? companies[0];

  if (!active) {
    // No companies yet — render a neutral placeholder. ensureBootstrap
    // creates "My Company" on first run, so this should never appear in
    // normal use; it's a defensive empty state for fresh installs.
    return (
      <div className="px-2 py-2 text-[10px] text-fg-subtle">
        Setting up workspace…
      </div>
    );
  }

  return (
    <div ref={ref} className="relative px-2 pb-2 pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="no-drag flex w-full items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-left text-xs text-fg-base transition-colors hover:bg-bg-hover"
        title="Switch active company"
      >
        <span
          className="h-3 w-3 shrink-0 rounded border border-border-base"
          style={{ background: active.color }}
          aria-hidden
        />
        <span className="truncate font-medium">{active.name}</span>
        <IconChevronDown size={11} className="ml-auto shrink-0 text-fg-subtle" />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full z-30 mt-1 rounded-md border border-border-base bg-bg-surface p-1 shadow-xl">
          <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-widest text-fg-subtle">
            Companies
          </div>
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                void setActive(c.id);
                setOpen(false);
              }}
              className={[
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                c.id === active.id
                  ? 'bg-bg-hover text-fg-base'
                  : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
              ].join(' ')}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded border border-border-base"
                style={{ background: c.color }}
              />
              <span className="flex-1 truncate">{c.name}</span>
              {c.id === active.id && (
                <IconCheck size={11} className="shrink-0 text-success" />
              )}
            </button>
          ))}

          <div className="my-1 border-t border-border-subtle" />
          <button
            onClick={() => {
              setOpen(false);
              navigate('/company');
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-base"
          >
            <IconBuilding size={11} />
            <span className="flex-1">Manage companies…</span>
          </button>
          <button
            onClick={() => {
              setOpen(false);
              navigate('/company?new=1');
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-base"
          >
            <IconPlus size={11} />
            <span className="flex-1">New company…</span>
          </button>
        </div>
      )}
    </div>
  );
}
