import type { ReactNode } from 'react';

export function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  /** Optional second line under the title — e.g. "Workspace for KT Ceramic"
   *  on the Dashboard. Keeps the header concrete about scope without
   *  needing a permanent active-workspace chip elsewhere. */
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="drag-region flex h-14 items-center justify-between border-b border-border-base bg-bg-surface px-6">
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight text-fg-base">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs text-fg-muted">
              {subtitle}
            </div>
          )}
        </div>
        {actions && <div className="no-drag flex items-center gap-2">{actions}</div>}
      </header>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
