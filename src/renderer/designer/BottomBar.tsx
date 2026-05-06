import { IconPlus, IconMinus, IconArrowsMaximize } from '@tabler/icons-react';
import { useDesignerStore } from '../stores/designerStore';

export function BottomBar() {
  const zoom = useDesignerStore((s) => s.zoom);
  const setZoom = useDesignerStore((s) => s.setZoom);
  const snap = useDesignerStore((s) => s.snap);
  const toggleSnap = useDesignerStore((s) => s.toggleSnap);
  const cursor = useDesignerStore((s) => s.cursorMm);
  const template = useDesignerStore((s) => s.template);
  const selectedIds = useDesignerStore((s) => s.selectedIds);

  const selected =
    selectedIds.length === 1
      ? template?.elements.find((e) => e.id === selectedIds[0])
      : undefined;

  const cycleZoom = (dir: 1 | -1) => {
    const order = ['fit', 1, 2, 3, 4] as const;
    const i = order.indexOf(zoom);
    const next = order[Math.max(0, Math.min(order.length - 1, i + dir))]!;
    setZoom(next);
  };

  return (
    <footer className="flex h-10 items-center justify-between border-t border-border-base bg-bg-surface px-3 text-xs text-fg-muted">
      <div className="flex items-center gap-2">
        <button
          onClick={() => cycleZoom(-1)}
          className="rounded p-1 hover:bg-bg-hover hover:text-fg-base"
          aria-label="Zoom out"
        >
          <IconMinus size={14} />
        </button>
        <span className="min-w-[3ch] text-center">
          {zoom === 'fit' ? 'Fit' : `${zoom}×`}
        </span>
        <button
          onClick={() => cycleZoom(1)}
          className="rounded p-1 hover:bg-bg-hover hover:text-fg-base"
          aria-label="Zoom in"
        >
          <IconPlus size={14} />
        </button>
        <button
          onClick={() => setZoom('fit')}
          className="ml-1 flex items-center gap-1 rounded px-2 py-1 hover:bg-bg-hover hover:text-fg-base"
          title="Fit to workspace"
        >
          <IconArrowsMaximize size={12} /> Fit
        </button>
        <span className="mx-2 h-4 w-px bg-border-base" />
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={snap} onChange={toggleSnap} />
          Snap (1mm)
        </label>
      </div>

      <div className="flex items-center gap-4">
        <span>
          x: {cursor.x.toFixed(1)} mm, y: {cursor.y.toFixed(1)} mm
        </span>
        {selected && (
          <span>
            W: {selected.width_mm.toFixed(1)} × H: {selected.height_mm.toFixed(1)} mm
          </span>
        )}
      </div>
    </footer>
  );
}
