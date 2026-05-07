import { useEffect, useRef, useState, useCallback } from 'react';
import { useDesignerStore } from '../stores/designerStore';
import { useBrandStore } from '../stores/brandStore';
import {
  isAspectLocked,
  type TemplateElement,
} from '../../shared/types/template';
import { ElementView } from './ElementView';

const PX_PER_MM_BASE = 4; // 1mm = 4px at 1× zoom

function snapMm(value: number, on: boolean): number {
  if (!on) return value;
  return Math.round(value);
}

// Eight resize anchors. The first letter is the vertical edge (n/s/'') and
// the second is the horizontal edge (e/w/''). Corners get two letters; edges
// get one. The empty-axis means the dimension on that axis is fixed.
type ResizeDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const RESIZE_CURSORS: Record<ResizeDir, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

export function Canvas() {
  const template = useDesignerStore((s) => s.template);
  const selectedIds = useDesignerStore((s) => s.selectedIds);
  const zoom = useDesignerStore((s) => s.zoom);
  const snapOn = useDesignerStore((s) => s.snap);
  const select = useDesignerStore((s) => s.select);
  const toggleSelect = useDesignerStore((s) => s.toggleSelect);
  const addElement = useDesignerStore((s) => s.addElement);
  const updateElement = useDesignerStore((s) => s.updateElement);
  const removeSelected = useDesignerStore((s) => s.removeSelected);
  const duplicateSelected = useDesignerStore((s) => s.duplicateSelected);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const pushHistory = useDesignerStore((s) => s.pushHistory);
  const setCursorMm = useDesignerStore((s) => s.setCursorMm);
  const brands = useBrandStore((s) => s.brands);
  const brand = template ? (brands.find((b) => b.id === template.brandId) ?? null) : null;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    if (!wrapRef.current || !template) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const padding = 64;
        const sx = (width - padding) / (template.width_mm * PX_PER_MM_BASE);
        const sy = (height - padding) / (template.height_mm * PX_PER_MM_BASE);
        setFitScale(Math.max(0.3, Math.min(10, Math.min(sx, sy))));
      }
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, [template?.width_mm, template?.height_mm, template]);

  const scale = template ? (zoom === 'fit' ? fitScale : zoom) : 1;
  const pxPerMm = PX_PER_MM_BASE * scale;

  const clientToMm = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left) / pxPerMm,
        y: (clientY - rect.top) / pxPerMm,
      };
    },
    [pxPerMm],
  );

  // Designer-scoped keyboard shortcuts
  useEffect(() => {
    if (!template) return;
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
        return;

      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (
        (meta && e.key.toLowerCase() === 'y') ||
        (meta && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          removeSelected();
        }
        return;
      }

      const dir =
        e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? 1
            : 0;
      if (dir === 0) return;
      const axis = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? 'x' : 'y';
      const amount = (e.shiftKey ? 0.1 : 1) * dir;

      if (selectedIds.length === 0) return;
      e.preventDefault();
      selectedIds.forEach((id) => {
        const el = template!.elements.find((x) => x.id === id);
        if (!el) return;
        if (axis === 'x') updateElement(id, { x_mm: el.x_mm + amount });
        else updateElement(id, { y_mm: el.y_mm + amount });
      });
      pushHistory();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    selectedIds,
    template,
    undo,
    redo,
    duplicateSelected,
    removeSelected,
    updateElement,
    pushHistory,
  ]);

  if (!template) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-fg-muted">
        No template loaded.
      </div>
    );
  }

  const canvasW = template.width_mm * pxPerMm;
  const canvasH = template.height_mm * pxPerMm;

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    const { x, y } = clientToMm(e.clientX, e.clientY);
    if (x >= 0 && y >= 0 && x <= template.width_mm && y <= template.height_mm) {
      setCursorMm(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
    }
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) select([]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-lskh-element');
    if (!raw) return;
    // Newer palette items ship a JSON spec ({ type, overrides }); older drags
    // shipped just the type string. Handle both for forward/back safety.
    let type: TemplateElement['type'];
    let overrides: Partial<TemplateElement> | undefined;
    try {
      const parsed = JSON.parse(raw) as {
        type: TemplateElement['type'];
        overrides?: Partial<TemplateElement> | null;
      };
      type = parsed.type;
      overrides = parsed.overrides ?? undefined;
    } catch {
      type = raw as TemplateElement['type'];
    }
    const { x, y } = clientToMm(e.clientX, e.clientY);
    addElement(
      type,
      Math.max(0, snapMm(x - 5, snapOn)),
      Math.max(0, snapMm(y - 5, snapOn)),
      overrides,
    );
  };

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full w-full items-center justify-center overflow-auto"
      style={{
        background:
          'repeating-conic-gradient(rgba(0,0,0,0.04) 0% 25%, transparent 25% 50%) 0 0/16px 16px',
      }}
    >
      <div
        ref={canvasRef}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="relative shadow-xl"
        style={{
          width: canvasW,
          height: canvasH,
          background: template.background,
          backgroundImage: snapOn
            ? `linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px),
               linear-gradient(to right, rgba(0,0,0,0.10) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(0,0,0,0.10) 1px, transparent 1px)`
            : undefined,
          backgroundSize: snapOn
            ? `${pxPerMm}px ${pxPerMm}px, ${pxPerMm}px ${pxPerMm}px, ${pxPerMm * 5}px ${pxPerMm * 5}px, ${pxPerMm * 5}px ${pxPerMm * 5}px`
            : undefined,
        }}
      >
        {[...template.elements]
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((el) => (
            <ElementBox
              key={el.id}
              element={el}
              brand={brand}
              pxPerMm={pxPerMm}
              snapOn={snapOn}
              selected={selectedIds.includes(el.id)}
              onSelect={(shift) => {
                if (shift) toggleSelect(el.id);
                else select([el.id]);
              }}
              onUpdate={(patch) => updateElement(el.id, patch)}
              onDragEnd={pushHistory}
              clientToMm={clientToMm}
            />
          ))}
      </div>
    </div>
  );
}

interface BoxProps {
  element: TemplateElement;
  brand: ReturnType<typeof useBrandStore.getState>['brands'][number] | null;
  pxPerMm: number;
  snapOn: boolean;
  selected: boolean;
  onSelect: (shift: boolean) => void;
  onUpdate: (patch: Partial<TemplateElement>) => void;
  onDragEnd: () => void;
  clientToMm: (cx: number, cy: number) => { x: number; y: number };
}

function ElementBox({
  element,
  brand,
  pxPerMm,
  snapOn,
  selected,
  onSelect,
  onUpdate,
  onDragEnd,
  clientToMm,
}: BoxProps) {
  if (!element.visible) return null;

  function startMove(e: React.MouseEvent) {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSelect(e.shiftKey);
    if (element.locked) return;

    const initial = { x_mm: element.x_mm, y_mm: element.y_mm };
    const start = clientToMm(e.clientX, e.clientY);
    let moved = false;

    const onMove = (ev: MouseEvent) => {
      const mm = clientToMm(ev.clientX, ev.clientY);
      const dx = mm.x - start.x;
      const dy = mm.y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.05) moved = true;
      onUpdate({
        x_mm: Math.max(0, snapMm(initial.x_mm + dx, snapOn)),
        y_mm: Math.max(0, snapMm(initial.y_mm + dy, snapOn)),
      } as Partial<TemplateElement>);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved) onDragEnd();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startResize(e: React.MouseEvent, dir: ResizeDir) {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSelect(e.shiftKey);
    if (element.locked) return;

    const initial = {
      x_mm: element.x_mm,
      y_mm: element.y_mm,
      width_mm: element.width_mm,
      height_mm: element.height_mm,
    };
    const start = clientToMm(e.clientX, e.clientY);
    const aspect = initial.width_mm / Math.max(initial.height_mm, 0.001);
    // Hold Shift to invert the locked-aspect default during drag.
    const baseLocked = isAspectLocked(element);
    let moved = false;

    const horizFromDir = dir.includes('w') ? -1 : dir.includes('e') ? 1 : 0;
    const vertFromDir = dir.includes('n') ? -1 : dir.includes('s') ? 1 : 0;

    const onMove = (ev: MouseEvent) => {
      const mm = clientToMm(ev.clientX, ev.clientY);
      const dxRaw = mm.x - start.x;
      const dyRaw = mm.y - start.y;
      if (Math.abs(dxRaw) + Math.abs(dyRaw) > 0.05) moved = true;

      const lockedNow = ev.shiftKey ? !baseLocked : baseLocked;

      // Start with the deltas implied by the active dir, sign-corrected so
      // outward dragging always grows the box.
      let dW = horizFromDir * dxRaw;
      let dH = vertFromDir * dyRaw;

      if (lockedNow) {
        if (horizFromDir !== 0 && vertFromDir !== 0) {
          // Corner: pick the dominant axis and scale the other from aspect.
          if (Math.abs(dxRaw) * (1 / aspect) >= Math.abs(dyRaw)) {
            dH = dW / aspect;
          } else {
            dW = dH * aspect;
          }
        } else if (horizFromDir !== 0) {
          dH = dW / aspect;
        } else if (vertFromDir !== 0) {
          dW = dH * aspect;
        }
      }

      let newW = Math.max(1, snapMm(initial.width_mm + dW, snapOn));
      let newH = Math.max(1, snapMm(initial.height_mm + dH, snapOn));
      // Re-snap to preserve the locked ratio if snapping rounded one axis.
      if (lockedNow) {
        if (horizFromDir !== 0 && (vertFromDir === 0 || dir === 'ne' || dir === 'se' || dir === 'nw' || dir === 'sw')) {
          newH = Math.max(1, newW / aspect);
        }
      }

      const patch: Partial<TemplateElement> = {
        width_mm: newW,
        height_mm: newH,
      };
      // For w/n handles, the position shifts so the opposite edge stays put.
      if (horizFromDir === -1) {
        patch.x_mm = Math.max(0, initial.x_mm + (initial.width_mm - newW));
      }
      if (vertFromDir === -1) {
        patch.y_mm = Math.max(0, initial.y_mm + (initial.height_mm - newH));
      }
      onUpdate(patch as Partial<TemplateElement>);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved) onDragEnd();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      onMouseDown={startMove}
      style={{
        position: 'absolute',
        left: element.x_mm * pxPerMm,
        top: element.y_mm * pxPerMm,
        width: element.width_mm * pxPerMm,
        height: element.height_mm * pxPerMm,
        zIndex: element.zIndex,
        outline: selected
          ? '1.5px solid rgb(var(--accent))'
          : '1px solid transparent',
        outlineOffset: 1,
        cursor: element.locked ? 'not-allowed' : 'move',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>
        <ElementView element={element} brand={brand} pxPerMm={pxPerMm} />
      </div>
      {selected && !element.locked && (
        <>
          <ResizeHandle dir="nw" onMouseDown={startResize} />
          <ResizeHandle dir="n" onMouseDown={startResize} />
          <ResizeHandle dir="ne" onMouseDown={startResize} />
          <ResizeHandle dir="e" onMouseDown={startResize} />
          <ResizeHandle dir="se" onMouseDown={startResize} />
          <ResizeHandle dir="s" onMouseDown={startResize} />
          <ResizeHandle dir="sw" onMouseDown={startResize} />
          <ResizeHandle dir="w" onMouseDown={startResize} />
        </>
      )}
    </div>
  );
}

function ResizeHandle({
  dir,
  onMouseDown,
}: {
  dir: ResizeDir;
  onMouseDown: (e: React.MouseEvent, dir: ResizeDir) => void;
}) {
  // 8 absolute positions around the box. Corner handles are 10×10 squares;
  // edge handles are thinner rectangles centred on the edge.
  const SIZE = 10;
  const pos: React.CSSProperties = { position: 'absolute' };
  switch (dir) {
    case 'nw':
      Object.assign(pos, { top: -SIZE / 2, left: -SIZE / 2, width: SIZE, height: SIZE });
      break;
    case 'ne':
      Object.assign(pos, { top: -SIZE / 2, right: -SIZE / 2, width: SIZE, height: SIZE });
      break;
    case 'sw':
      Object.assign(pos, { bottom: -SIZE / 2, left: -SIZE / 2, width: SIZE, height: SIZE });
      break;
    case 'se':
      Object.assign(pos, { bottom: -SIZE / 2, right: -SIZE / 2, width: SIZE, height: SIZE });
      break;
    case 'n':
      Object.assign(pos, {
        top: -SIZE / 2,
        left: '50%',
        transform: 'translateX(-50%)',
        width: SIZE * 1.4,
        height: SIZE,
      });
      break;
    case 's':
      Object.assign(pos, {
        bottom: -SIZE / 2,
        left: '50%',
        transform: 'translateX(-50%)',
        width: SIZE * 1.4,
        height: SIZE,
      });
      break;
    case 'e':
      Object.assign(pos, {
        right: -SIZE / 2,
        top: '50%',
        transform: 'translateY(-50%)',
        width: SIZE,
        height: SIZE * 1.4,
      });
      break;
    case 'w':
      Object.assign(pos, {
        left: -SIZE / 2,
        top: '50%',
        transform: 'translateY(-50%)',
        width: SIZE,
        height: SIZE * 1.4,
      });
      break;
  }
  return (
    <div
      onMouseDown={(e) => onMouseDown(e, dir)}
      style={{
        ...pos,
        background: 'rgb(var(--accent))',
        border: '1.5px solid white',
        borderRadius: 2,
        cursor: RESIZE_CURSORS[dir],
      }}
    />
  );
}
