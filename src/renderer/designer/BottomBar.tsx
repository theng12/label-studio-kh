import { useState } from 'react';
import {
  IconPlus,
  IconMinus,
  IconArrowsMaximize,
  IconRulerMeasure,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useDesignerStore } from '../stores/designerStore';
import { PreviewActualSize } from './PreviewActualSize';

const SIZE_WARNING_AREA_MM2 = 400; // matches the default in SettingsService
const ELEMENTS_WARNING_THRESHOLD = 6;

export function BottomBar() {
  const zoom = useDesignerStore((s) => s.zoom);
  const setZoom = useDesignerStore((s) => s.setZoom);
  const snap = useDesignerStore((s) => s.snap);
  const toggleSnap = useDesignerStore((s) => s.toggleSnap);
  const cursor = useDesignerStore((s) => s.cursorMm);
  const template = useDesignerStore((s) => s.template);
  const selectedIds = useDesignerStore((s) => s.selectedIds);

  const [previewOpen, setPreviewOpen] = useState(false);

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

  // Soft size warning: tiny stickers + many elements = likely unreadable in print.
  const sizeWarning =
    template &&
    template.width_mm * template.height_mm < SIZE_WARNING_AREA_MM2 &&
    template.elements.length >= ELEMENTS_WARNING_THRESHOLD;

  return (
    <>
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
          <button
            onClick={() => setPreviewOpen(true)}
            className="ml-1 flex items-center gap-1 rounded px-2 py-1 hover:bg-bg-hover hover:text-fg-base"
            title="Show the sticker at 1:1 physical size"
          >
            <IconRulerMeasure size={12} /> Actual size
          </button>
          <span className="mx-2 h-4 w-px bg-border-base" />
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={snap} onChange={toggleSnap} />
            Snap (1mm)
          </label>
        </div>

        <div className="flex items-center gap-4">
          {sizeWarning && (
            <span
              className="flex items-center gap-1 text-warning"
              title="This sticker is small and has many elements — some may be hard to read when printed."
            >
              <IconAlertTriangle size={12} />
              Tight layout
            </span>
          )}
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

      {previewOpen && <PreviewActualSize onClose={() => setPreviewOpen(false)} />}
    </>
  );
}
