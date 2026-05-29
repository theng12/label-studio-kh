import { useEffect, useRef, useState, useCallback } from 'react';
import { useDesignerStore, unionBounds } from '../stores/designerStore';
import type { BBoxAnchor } from '../stores/designerStore';
import { useBrandStore } from '../stores/brandStore';
import {
  isAspectLocked,
  type TemplateElement,
} from '../../shared/types/template';
import { ElementView } from './ElementView';

/**
 * Snap distance when dragging an element near another element's edge or
 * center line, in mm. Loose enough to feel sticky, tight enough that you can
 * still place freely with a small extra wiggle.
 */
const SMART_GUIDE_SNAP_MM = 1;

interface Guide {
  axis: 'x' | 'y';
  /** Position in mm along the perpendicular axis. */
  value: number;
}

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
  const setZoom = useDesignerStore((s) => s.setZoom);
  const select = useDesignerStore((s) => s.select);
  const toggleSelect = useDesignerStore((s) => s.toggleSelect);
  const addElement = useDesignerStore((s) => s.addElement);
  const updateElement = useDesignerStore((s) => s.updateElement);
  const removeSelected = useDesignerStore((s) => s.removeSelected);
  const duplicateSelected = useDesignerStore((s) => s.duplicateSelected);
  const bringToFront = useDesignerStore((s) => s.bringToFront);
  const sendToBack = useDesignerStore((s) => s.sendToBack);
  const toggleLock = useDesignerStore((s) => s.toggleLock);
  const groupSelected = useDesignerStore((s) => s.groupSelected);
  const ungroup = useDesignerStore((s) => s.ungroup);
  const copySelected = useDesignerStore((s) => s.copySelected);
  const paste = useDesignerStore((s) => s.paste);
  const clipboardSize = useDesignerStore((s) => s.clipboard?.length ?? 0);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const pushHistory = useDesignerStore((s) => s.pushHistory);
  const setCursorMm = useDesignerStore((s) => s.setCursorMm);
  const resizeSelectionBoundingBox = useDesignerStore((s) => s.resizeSelectionBoundingBox);
  const brands = useBrandStore((s) => s.brands);
  const brand = template ? (brands.find((b) => b.id === template.brandId) ?? null) : null;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [marquee, setMarquee] = useState<null | {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }>(null);
  const [menu, setMenu] = useState<null | {
    x: number;
    y: number;
    elementId: string;
  }>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

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

  // Trackpad pinch and Cmd/Ctrl+scroll → continuous zoom. React's onWheel is
  // passive so we attach the listener manually with passive: false to allow
  // preventDefault and stop the wrapper from also scrolling.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // macOS trackpad pinch comes through as wheel with ctrlKey=true.
      // Cmd/Ctrl + scroll is the desktop equivalent.
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const current =
        zoom === 'fit' ? fitScale / PX_PER_MM_BASE : (zoom as number);
      // deltaY < 0 = pinch out / scroll up = zoom in. Sensitivity capped so
      // a hard pinch doesn't blow past the user's intent.
      const factor = Math.exp(-e.deltaY * 0.005);
      const next = Math.max(0.25, Math.min(8, current * factor));
      setZoom(Math.round(next * 100) / 100);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, fitScale, setZoom]);

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
    // Marquee starts on left-click in empty canvas area only — clicks on
    // elements bubble out via stopPropagation in ElementBox.
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x0 = e.clientX - rect.left;
    const y0 = e.clientY - rect.top;
    const additive = e.shiftKey;
    const baseSelection = additive ? selectedIds : [];
    const elementsSnapshot = template ? template.elements : [];
    const pxSnapshot = pxPerMm;
    let dragged = false;
    setMarquee({ x0, y0, x1: x0, y1: y0 });

    const onMove = (ev: MouseEvent) => {
      const x1 = ev.clientX - rect.left;
      const y1 = ev.clientY - rect.top;
      if (!dragged && Math.abs(x1 - x0) + Math.abs(y1 - y0) > 2) dragged = true;
      setMarquee({ x0, y0, x1, y1 });
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setMarquee(null);
      if (!dragged) {
        // Plain click in empty area clears selection (preserve old behavior);
        // shift-click leaves the existing selection alone.
        if (!additive) select([]);
        return;
      }
      const x1 = ev.clientX - rect.left;
      const y1 = ev.clientY - rect.top;
      const mLeft = Math.min(x0, x1);
      const mRight = Math.max(x0, x1);
      const mTop = Math.min(y0, y1);
      const mBottom = Math.max(y0, y1);
      const hits = elementsSnapshot
        .filter((el) => {
          if (!el.visible) return false;
          const eLeft = el.x_mm * pxSnapshot;
          const eRight = eLeft + el.width_mm * pxSnapshot;
          const eTop = el.y_mm * pxSnapshot;
          const eBottom = eTop + el.height_mm * pxSnapshot;
          return eLeft < mRight && eRight > mLeft && eTop < mBottom && eBottom > mTop;
        })
        .map((el) => el.id);
      if (additive) {
        select(Array.from(new Set([...baseSelection, ...hits])));
      } else {
        select(hits);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const openContextMenuFor = (e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIds.includes(elementId)) select([elementId]);
    setMenu({ x: e.clientX, y: e.clientY, elementId });
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
        onContextMenu={(e) => e.preventDefault()}
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
              hideHandles={selectedIds.length >= 2}
              selectedIds={selectedIds}
              siblings={template.elements}
              onSelect={(shift) => {
                if (shift) toggleSelect(el.id);
                else select([el.id]);
              }}
              onUpdate={(patch) => updateElement(el.id, patch)}
              onUpdateMany={(patches) =>
                patches.forEach((p) => updateElement(p.id, p.patch))
              }
              onDragEnd={pushHistory}
              onGuides={setGuides}
              clientToMm={clientToMm}
              onContextMenu={(e) => openContextMenuFor(e, el.id)}
            />
          ))}
        {selectedIds.length >= 2 && (
          <BoundingBoxOverlay
            elements={template.elements.filter((el) => selectedIds.includes(el.id))}
            pxPerMm={pxPerMm}
            onResize={resizeSelectionBoundingBox}
            onResizeEnd={pushHistory}
            clientToMm={clientToMm}
          />
        )}
        {guides.map((g, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              background: '#ff00aa',
              zIndex: 9998,
              ...(g.axis === 'x'
                ? {
                    left: g.value * pxPerMm,
                    top: 0,
                    width: 1,
                    height: canvasH,
                  }
                : {
                    top: g.value * pxPerMm,
                    left: 0,
                    height: 1,
                    width: canvasW,
                  }),
            }}
          />
        ))}
        {marquee && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
              background: 'rgb(var(--accent) / 0.10)',
              border: '1px dashed rgb(var(--accent))',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          />
        )}
      </div>
      {menu &&
        (() => {
          const target = template.elements.find((el) => el.id === menu.elementId);
          if (!target) return null;
          const targets = selectedIds.length > 0 ? selectedIds : [menu.elementId];
          const canGroup = targets.length >= 2;
          const targetGroupId = target.groupId;
          const items: ContextMenuItem[] = [
            {
              label: 'Copy',
              shortcut: '⌘C',
              onClick: () => copySelected(),
            },
            {
              label: clipboardSize > 0 ? `Paste (${clipboardSize})` : 'Paste',
              shortcut: '⌘V',
              disabled: clipboardSize === 0,
              onClick: () => paste(),
            },
            {
              label: 'Duplicate',
              shortcut: '⌘D',
              onClick: () => duplicateSelected(),
            },
            {
              label: 'Delete',
              onClick: () => removeSelected(),
            },
            { divider: true },
            {
              label: 'Group',
              shortcut: '⌘G',
              disabled: !canGroup,
              onClick: () => groupSelected(),
            },
            {
              label: 'Ungroup',
              shortcut: '⌘⇧G',
              disabled: !targetGroupId,
              onClick: () => targetGroupId && ungroup(targetGroupId),
            },
            { divider: true },
            {
              label: target.locked ? 'Unlock' : 'Lock',
              onClick: () => {
                if (targets.length === 1) {
                  toggleLock(targets[0]!);
                } else {
                  // Force all in selection to the opposite of the right-clicked
                  // element's state so the result is consistent.
                  const next = !target.locked;
                  targets.forEach((id) => updateElement(id, { locked: next }));
                  pushHistory();
                }
              },
            },
            { divider: true },
            {
              label: 'Bring to Front',
              onClick: () => targets.forEach((id) => bringToFront(id)),
            },
            {
              label: 'Send to Back',
              onClick: () => targets.forEach((id) => sendToBack(id)),
            },
          ];
          return (
            <ContextMenu
              x={menu.x}
              y={menu.y}
              items={items}
              onClose={() => setMenu(null)}
            />
          );
        })()}
    </div>
  );
}

interface ContextMenuItem {
  label?: string;
  shortcut?: string;
  divider?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'fixed', left: x, top: y, zIndex: 10000 }}
      className="min-w-[160px] rounded-md border border-border-base bg-bg-surface py-1 text-xs shadow-xl"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="my-1 h-px bg-border-base" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.onClick?.();
              onClose();
            }}
            className={[
              'flex w-full items-center justify-between px-3 py-1 text-left',
              item.disabled
                ? 'cursor-not-allowed text-fg-subtle'
                : 'text-fg-base hover:bg-bg-hover',
            ].join(' ')}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="ml-4 text-fg-subtle">{item.shortcut}</span>
            )}
          </button>
        ),
      )}
    </div>
  );
}

interface BoxProps {
  element: TemplateElement;
  brand: ReturnType<typeof useBrandStore.getState>['brands'][number] | null;
  pxPerMm: number;
  snapOn: boolean;
  selected: boolean;
  /** When true, suppress per-element resize handles (multi-select bbox owns them). */
  hideHandles: boolean;
  /** Currently selected element ids — used to build the multi-element drag set. */
  selectedIds: string[];
  /** Every element in the template, used to compute alignment guides during drag. */
  siblings: TemplateElement[];
  onSelect: (shift: boolean) => void;
  onUpdate: (patch: Partial<TemplateElement>) => void;
  onUpdateMany: (patches: { id: string; patch: Partial<TemplateElement> }[]) => void;
  onDragEnd: () => void;
  onGuides: (guides: Guide[]) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  clientToMm: (cx: number, cy: number) => { x: number; y: number };
}

function ElementBox({
  element,
  brand,
  pxPerMm,
  snapOn,
  selected,
  hideHandles,
  selectedIds,
  siblings,
  onSelect,
  onUpdate,
  onUpdateMany,
  onDragEnd,
  onGuides,
  onContextMenu,
  clientToMm,
}: BoxProps) {
  if (!element.visible) return null;

  function startMove(e: React.MouseEvent) {
    e.stopPropagation();
    if (e.button !== 0) return;
    // If the click lands on an unselected element, treat that as a fresh
    // single-element selection for the drag — otherwise the drag would still
    // operate on the prior selection, which is confusing.
    const wasSelected = selected;
    onSelect(e.shiftKey);
    if (element.locked) return;

    // Capture every element that should travel with this drag. When the
    // dragged element was already part of the selection (a group, or a
    // multi-select), all selected elements move together by the same delta.
    const movers =
      wasSelected && selectedIds.length > 1
        ? siblings.filter((el) => selectedIds.includes(el.id) && !el.locked)
        : [element];
    const initials = new Map(
      movers.map((el) => [el.id, { x_mm: el.x_mm, y_mm: el.y_mm }]),
    );
    const start = clientToMm(e.clientX, e.clientY);
    let moved = false;
    // Snapshot siblings (excluding the dragged element & invisible ones) once
    // at drag start so guide candidates don't churn on every mousemove.
    const otherEls = siblings.filter((e) => e.visible && e.id !== element.id);

    const onMove = (ev: MouseEvent) => {
      const mm = clientToMm(ev.clientX, ev.clientY);
      const dx = mm.x - start.x;
      const dy = mm.y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.05) moved = true;
      if (movers.length === 1) {
        // Single-element drag: enable smart-guide snap against siblings.
        const init = initials.get(element.id)!;
        let nextX = Math.max(0, snapMm(init.x_mm + dx, snapOn));
        let nextY = Math.max(0, snapMm(init.y_mm + dy, snapOn));

        const active: Guide[] = [];
        if (otherEls.length > 0) {
          const w = element.width_mm;
          const h = element.height_mm;
          // X-axis: try aligning left, center, right against every sibling's
          // left, center, right. Pick the smallest delta within the threshold
          // and snap; record the matched line(s) so we can render them.
          const xCandidates = otherEls.flatMap((s) => [
            s.x_mm,
            s.x_mm + s.width_mm / 2,
            s.x_mm + s.width_mm,
          ]);
          const yCandidates = otherEls.flatMap((s) => [
            s.y_mm,
            s.y_mm + s.height_mm / 2,
            s.y_mm + s.height_mm,
          ]);
          const xEdges = [nextX, nextX + w / 2, nextX + w];
          const yEdges = [nextY, nextY + h / 2, nextY + h];
          let bestX: { delta: number; target: number } | null = null;
          for (let i = 0; i < xEdges.length; i++) {
            for (const tgt of xCandidates) {
              const d = tgt - xEdges[i]!;
              if (Math.abs(d) <= SMART_GUIDE_SNAP_MM && (!bestX || Math.abs(d) < Math.abs(bestX.delta))) {
                bestX = { delta: d, target: tgt };
              }
            }
          }
          if (bestX) {
            nextX = Math.max(0, nextX + bestX.delta);
            active.push({ axis: 'x', value: bestX.target });
          }
          let bestY: { delta: number; target: number } | null = null;
          for (let i = 0; i < yEdges.length; i++) {
            for (const tgt of yCandidates) {
              const d = tgt - yEdges[i]!;
              if (Math.abs(d) <= SMART_GUIDE_SNAP_MM && (!bestY || Math.abs(d) < Math.abs(bestY.delta))) {
                bestY = { delta: d, target: tgt };
              }
            }
          }
          if (bestY) {
            nextY = Math.max(0, nextY + bestY.delta);
            active.push({ axis: 'y', value: bestY.target });
          }
        }
        onGuides(active);

        onUpdate({
          x_mm: nextX,
          y_mm: nextY,
        } as Partial<TemplateElement>);
      } else {
        // Multi-element / group drag: move every mover by the same delta.
        // Smart guides are skipped — snapping each member independently would
        // distort the relative layout.
        onGuides([]);
        onUpdateMany(
          movers.map((m) => {
            const init = initials.get(m.id)!;
            return {
              id: m.id,
              patch: {
                x_mm: Math.max(0, snapMm(init.x_mm + dx, snapOn)),
                y_mm: Math.max(0, snapMm(init.y_mm + dy, snapOn)),
              } as Partial<TemplateElement>,
            };
          }),
        );
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onGuides([]);
      if (moved) onDragEnd();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startResize(e: React.MouseEvent, dir: ResizeDir) {
    e.stopPropagation();
    if (e.button !== 0) return;
    const wasSelected = selected;
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
    // Resize sibling elements alongside this one when the dragged element is
    // part of a multi-element selection (group or marquee). Each sibling
    // grows by the same width/height delta and shifts position the same way
    // as the active handle dictates — simple uniform translation, NOT
    // proportional scaling around the group bbox.
    const resizeMovers =
      wasSelected && selectedIds.length > 1
        ? siblings.filter(
            (el) => selectedIds.includes(el.id) && el.id !== element.id && !el.locked,
          )
        : [];
    const siblingInitials = new Map<string, { x_mm: number; y_mm: number; width_mm: number; height_mm: number }>(
      resizeMovers.map((s) => [
        s.id,
        {
          x_mm: s.x_mm,
          y_mm: s.y_mm,
          width_mm: s.width_mm,
          height_mm: s.height_mm,
        },
      ]),
    );

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
      if (siblings.length === 0) {
        onUpdate(patch as Partial<TemplateElement>);
        return;
      }
      // Same width/height delta applied to every sibling, with the same
      // anchor-edge translation as the active handle. Exact widths/heights
      // would distort siblings with different starting sizes.
      const widthDelta = newW - initial.width_mm;
      const heightDelta = newH - initial.height_mm;
      const xDelta = (patch.x_mm ?? initial.x_mm) - initial.x_mm;
      const yDelta = (patch.y_mm ?? initial.y_mm) - initial.y_mm;
      const updates: { id: string; patch: Partial<TemplateElement> }[] = [
        { id: element.id, patch },
      ];
      for (const sib of resizeMovers) {
        const init = siblingInitials.get(sib.id)!;
        const sPatch: Partial<TemplateElement> = {
          width_mm: Math.max(1, init.width_mm + widthDelta),
          height_mm: Math.max(1, init.height_mm + heightDelta),
          x_mm: Math.max(0, init.x_mm + xDelta),
          y_mm: Math.max(0, init.y_mm + yDelta),
        };
        updates.push({ id: sib.id, patch: sPatch });
      }
      onUpdateMany(updates);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved) onDragEnd();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Rotate the whole box (content + selection outline + handles travel as one
  // unit). For v1 the resize/drag math still operates in the AABB frame —
  // good enough for typical "stamp this text at 45°" use cases.
  const rotation = element.rotation ?? 0;

  return (
    <div
      onMouseDown={startMove}
      onContextMenu={onContextMenu}
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
        transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
    >
      <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>
        <ElementView element={element} brand={brand} pxPerMm={pxPerMm} />
      </div>
      {selected && !element.locked && !hideHandles && (
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
  styleOverride,
}: {
  dir: ResizeDir;
  onMouseDown: (e: React.MouseEvent, dir: ResizeDir) => void;
  styleOverride?: React.CSSProperties;
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
        ...(styleOverride ?? {}),
      }}
    />
  );
}

// Maps a handle direction to the anchor point that stays put while dragging
// it. The opposite corner/edge always anchors so the box scales away from the
// fixed reference instead of around its center.
const ANCHOR_FOR_DIR: Record<ResizeDir, BBoxAnchor> = {
  nw: 'bottom-right',
  n: 'bottom',
  ne: 'bottom-left',
  e: 'left',
  se: 'top-left',
  s: 'top',
  sw: 'top-right',
  w: 'right',
};

interface BBoxProps {
  elements: TemplateElement[];
  pxPerMm: number;
  onResize: (
    snapshot: Array<Pick<TemplateElement, 'id' | 'x_mm' | 'y_mm' | 'width_mm' | 'height_mm'>>,
    scaleX: number,
    scaleY: number,
    anchor: BBoxAnchor,
  ) => void;
  onResizeEnd: () => void;
  clientToMm: (cx: number, cy: number) => { x: number; y: number };
}

function BoundingBoxOverlay({
  elements,
  pxPerMm,
  onResize,
  onResizeEnd,
  clientToMm,
}: BBoxProps) {
  const bb = unionBounds(elements);
  if (!bb || bb.width <= 0 || bb.height <= 0) return null;

  function startBBoxResize(e: React.MouseEvent, dir: ResizeDir) {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    const initialBB = { ...bb! };
    const snapshot = elements.map((el) => ({
      id: el.id,
      x_mm: el.x_mm,
      y_mm: el.y_mm,
      width_mm: el.width_mm,
      height_mm: el.height_mm,
    }));
    const start = clientToMm(e.clientX, e.clientY);
    const anchor = ANCHOR_FOR_DIR[dir];
    let moved = false;

    const onMove = (ev: MouseEvent) => {
      const mm = clientToMm(ev.clientX, ev.clientY);
      const dx = mm.x - start.x;
      const dy = mm.y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.05) moved = true;

      let newW = initialBB.width;
      let newH = initialBB.height;
      if (dir.includes('e')) newW = initialBB.width + dx;
      if (dir.includes('w')) newW = initialBB.width - dx;
      if (dir.includes('s')) newH = initialBB.height + dy;
      if (dir.includes('n')) newH = initialBB.height - dy;
      // Clamp to a tiny minimum so the user can't collapse the box and lose
      // the elements; sign is preserved so flipping past zero is still a flip.
      const min = 0.5;
      if (Math.abs(newW) < min) newW = newW < 0 ? -min : min;
      if (Math.abs(newH) < min) newH = newH < 0 ? -min : min;

      let scaleX = (dir.includes('e') || dir.includes('w')) ? newW / initialBB.width : 1;
      let scaleY = (dir.includes('n') || dir.includes('s')) ? newH / initialBB.height : 1;

      // Shift = uniform scale. Use the larger magnitude so the user feels in
      // control; sign tracks the dominant axis.
      if (ev.shiftKey) {
        if (scaleX !== 1 && scaleY !== 1) {
          const mag = Math.max(Math.abs(scaleX), Math.abs(scaleY));
          scaleX = (scaleX < 0 ? -1 : 1) * mag;
          scaleY = (scaleY < 0 ? -1 : 1) * mag;
        } else if (scaleX !== 1) {
          scaleY = scaleX;
        } else if (scaleY !== 1) {
          scaleX = scaleY;
        }
      }
      onResize(snapshot, scaleX, scaleY, anchor);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved) onResizeEnd();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const dirs: ResizeDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  return (
    <div
      style={{
        position: 'absolute',
        left: bb.x * pxPerMm,
        top: bb.y * pxPerMm,
        width: bb.width * pxPerMm,
        height: bb.height * pxPerMm,
        outline: '1.5px dashed rgb(var(--accent))',
        outlineOffset: 1,
        pointerEvents: 'none',
        zIndex: 9997,
      }}
    >
      {dirs.map((d) => (
        <ResizeHandle
          key={d}
          dir={d}
          onMouseDown={startBBoxResize}
          styleOverride={{ pointerEvents: 'auto' }}
        />
      ))}
    </div>
  );
}
