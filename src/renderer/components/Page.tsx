import type { ReactNode } from 'react';

export function Page({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="drag-region flex h-12 items-center justify-between border-b border-border-base bg-bg-surface px-6">
        <h1 className="text-sm font-semibold text-fg-base">{title}</h1>
        {actions && <div className="no-drag flex items-center gap-2">{actions}</div>}
      </header>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
