import { useEffect, useRef, useState } from 'react';
import { IconX, IconGripVertical } from '@tabler/icons-react';
import { useDesignerStore } from '../stores/designerStore';
import { useBrandStore } from '../stores/brandStore';
import { ElementView } from './ElementView';

// CSS pixels to mm at 96dpi: 1 mm = 96 / 25.4 ≈ 3.7795 px.
const CSS_PX_PER_MM = 96 / 25.4;

interface Props {
  onClose: () => void;
}

// Floating, draggable panel showing the sticker at 1:1 physical size based on a
// 96dpi screen estimate. Informational — does not change canvas zoom.
export function PreviewActualSize({ onClose }: Props) {
  const template = useDesignerStore((s) => s.template);
  const brands = useBrandStore((s) => s.brands);
  const brand = template ? (brands.find((b) => b.id === template.brandId) ?? null) : null;
  const [pos, setPos] = useState({ x: 32, y: 80 });
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.sx + (e.clientX - dragRef.current.ox),
        y: dragRef.current.sy + (e.clientY - dragRef.current.oy),
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!template) return null;

  const w = template.width_mm * CSS_PX_PER_MM;
  const h = template.height_mm * CSS_PX_PER_MM;

  return (
    <div
      className="fixed z-40 rounded-lg border border-border-base bg-bg-surface shadow-xl"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        onMouseDown={(e) => {
          dragRef.current = {
            ox: e.clientX,
            oy: e.clientY,
            sx: pos.x,
            sy: pos.y,
          };
        }}
        className="flex cursor-grab items-center justify-between gap-2 border-b border-border-subtle px-2 py-1.5 active:cursor-grabbing"
      >
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <IconGripVertical size={12} />
          <span>Actual size · {template.width_mm}×{template.height_mm}mm</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-base"
          aria-label="Close"
        >
          <IconX size={12} />
        </button>
      </div>
      <div className="p-3">
        <div
          className="relative bg-white"
          style={{
            width: w,
            height: h,
            outline: '1px solid rgba(0,0,0,0.15)',
          }}
        >
          {[...template.elements]
            .sort((a, b) => a.zIndex - b.zIndex)
            .filter((el) => el.visible)
            .map((el) => (
              <div
                key={el.id}
                style={{
                  position: 'absolute',
                  left: el.x_mm * CSS_PX_PER_MM,
                  top: el.y_mm * CSS_PX_PER_MM,
                  width: el.width_mm * CSS_PX_PER_MM,
                  height: el.height_mm * CSS_PX_PER_MM,
                  zIndex: el.zIndex,
                  overflow: 'hidden',
                }}
              >
                <ElementView element={el} brand={brand} pxPerMm={CSS_PX_PER_MM} />
              </div>
            ))}
        </div>
        <div className="mt-2 text-[10px] text-fg-subtle">
          Approximate — depends on your monitor's actual DPI.
        </div>
      </div>
    </div>
  );
}
