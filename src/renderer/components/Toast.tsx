import { useEffect, useState } from 'react';
import { create } from 'zustand';
import {
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (kind: ToastKind, message: string) => string;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (kind, message) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    set({ items: [...get().items, { id, kind, message }] });
    return id;
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

// Global API. Callable from anywhere — no React tree, no prop drilling.
// The container subscribes to the same store and renders whatever is queued.
export const toast = {
  success: (message: string) =>
    useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
  info: (message: string) => useToastStore.getState().push('info', message),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

const AUTO_DISMISS_MS: Record<ToastKind, number> = {
  success: 4000,
  info: 4000,
  error: 7000,
};

const ICON: Record<ToastKind, typeof IconCheck> = {
  success: IconCheck,
  error: IconAlertTriangle,
  info: IconInfoCircle,
};

const ACCENT: Record<ToastKind, string> = {
  success: 'border-l-success text-success',
  error: 'border-l-danger text-danger',
  info: 'border-l-accent text-accent',
};

function ToastRow({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  // Mount unmounted → animate in. Reverse on dismiss for an exit transition.
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => startDismiss(), AUTO_DISMISS_MS[item.kind]);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.kind]);

  const startDismiss = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => dismiss(item.id), 150);
  };

  const Icon = ICON[item.kind];

  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      onClick={startDismiss}
      className={[
        'pointer-events-auto flex w-80 cursor-pointer items-start gap-2 rounded-md border border-l-4 border-border-base bg-bg-surface p-3 text-sm text-fg-base shadow-lg transition-all duration-150',
        ACCENT[item.kind],
        shown && !leaving
          ? 'translate-x-0 opacity-100'
          : 'translate-x-4 opacity-0',
      ].join(' ')}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 break-words text-fg-base">{item.message}</div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={(e) => {
          e.stopPropagation();
          startDismiss();
        }}
        className="shrink-0 rounded p-0.5 text-fg-subtle hover:bg-bg-hover hover:text-fg-base"
      >
        <IconX size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const items = useToastStore((s) => s.items);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2"
    >
      {items.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  );
}
