import { create } from 'zustand';
import type { Template, TemplateElement, ElementType } from '../../shared/types/template';
import { defaultElement } from '../designer/elementDefaults';

export type Zoom = 'fit' | number;

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

/**
 * Anchor for bounding-box resizes. Identifies the corner/midpoint of the
 * union bounding box that stays put while the opposite handle is dragged.
 */
export type BBoxAnchor =
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function unionBounds(elements: Pick<TemplateElement, 'x_mm' | 'y_mm' | 'width_mm' | 'height_mm'>[]): Bounds | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    if (el.x_mm < minX) minX = el.x_mm;
    if (el.y_mm < minY) minY = el.y_mm;
    if (el.x_mm + el.width_mm > maxX) maxX = el.x_mm + el.width_mm;
    if (el.y_mm + el.height_mm > maxY) maxY = el.y_mm + el.height_mm;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

interface DesignerState {
  template: Template | null;
  selectedIds: string[];
  zoom: Zoom;
  snap: boolean;
  cursorMm: { x: number; y: number };

  history: Template[];
  historyIndex: number;

  /**
   * A monotonically increasing counter, bumped whenever the template is
   * mutated through history-pushing actions. Compared to savedVersion to
   * decide whether the Save button should be active. Cheap O(1) check.
   */
  version: number;
  savedVersion: number;
  lastSavedAt: string | null;
  isDirty: boolean;

  setTemplate: (t: Template) => void;
  markSaved: (saved: Template) => void;

  patchTemplate: (patch: Partial<Template>) => void;
  setOrientation: (orientation: 'portrait' | 'landscape') => void;
  setDimensions: (width_mm: number, height_mm: number) => void;

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;

  addElement: (
    type: ElementType,
    x_mm: number,
    y_mm: number,
    overrides?: Partial<TemplateElement>,
  ) => void;
  updateElement: (id: string, patch: Partial<TemplateElement>) => void;
  removeSelected: () => void;
  clearAllElements: () => void;
  duplicateSelected: () => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  toggleLock: (id: string) => void;
  reorderElement: (id: string, direction: 'up' | 'down') => void;
  /**
   * Reorder layers using positions in the Layers panel (top-most-first list).
   * `fromIndex`/`toIndex` follow array-splice semantics: the row being moved
   * is conceptually removed from `fromIndex` first, then inserted before
   * `toIndex`. `toIndex === sorted.length` means "drop at the bottom".
   * Reassigns sequential zIndex values so the new visual order sticks.
   */
  reorderLayer: (fromIndex: number, toIndex: number) => void;

  alignSelected: (mode: AlignMode) => void;
  distributeSelected: (axis: DistributeAxis) => void;
  /**
   * Scale every selected element relative to the union bounding box's anchor
   * (the opposite corner/edge of the dragged handle). Positions and sizes
   * scale together so the visual relationships are preserved.
   *
   * Takes a snapshot of the selected elements' initial geometry so each call
   * during a drag is idempotent (no compounding). Caller is responsible for
   * `pushHistory()` once on mouseup so the whole drag is one history entry.
   */
  resizeSelectionBoundingBox: (
    snapshot: Array<Pick<TemplateElement, 'id' | 'x_mm' | 'y_mm' | 'width_mm' | 'height_mm'>>,
    scaleX: number,
    scaleY: number,
    anchor: BBoxAnchor,
  ) => void;

  setZoom: (z: Zoom) => void;
  toggleSnap: () => void;
  setCursorMm: (x: number, y: number) => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const HISTORY_LIMIT = 50;

function uid(): string {
  return crypto.randomUUID();
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  template: null,
  selectedIds: [],
  zoom: 'fit',
  snap: true,
  cursorMm: { x: 0, y: 0 },

  history: [],
  historyIndex: -1,

  version: 0,
  savedVersion: 0,
  lastSavedAt: null,
  isDirty: false,

  setTemplate: (template) => {
    // Freshly loaded → version aligns with savedVersion. New templates (no id
    // yet) start dirty so the Save button lights up on first edit.
    const isNew = !template.id;
    set({
      template,
      selectedIds: [],
      history: [structuredClone(template)],
      historyIndex: 0,
      version: 0,
      savedVersion: isNew ? -1 : 0,
      lastSavedAt: isNew ? null : (template.updatedAt ?? null),
      isDirty: isNew,
    });
  },

  markSaved: (saved) => {
    const v = get().version;
    set({
      template: saved,
      savedVersion: v,
      lastSavedAt: saved.updatedAt ?? new Date().toISOString(),
      isDirty: false,
    });
  },

  patchTemplate: (patch) => {
    const t = get().template;
    if (!t) return;
    set({ template: { ...t, ...patch, updatedAt: new Date().toISOString() } });
    get().pushHistory();
  },

  setOrientation: (orientation) => {
    const t = get().template;
    if (!t) return;
    // Swap dimensions if they don't match the new orientation.
    const isCurrentlyLandscape = t.width_mm > t.height_mm;
    const wantsLandscape = orientation === 'landscape';
    const needsSwap = wantsLandscape !== isCurrentlyLandscape && t.width_mm !== t.height_mm;
    set({
      template: {
        ...t,
        orientation,
        width_mm: needsSwap ? t.height_mm : t.width_mm,
        height_mm: needsSwap ? t.width_mm : t.height_mm,
        updatedAt: new Date().toISOString(),
      },
    });
    get().pushHistory();
  },

  setDimensions: (width_mm, height_mm) => {
    const t = get().template;
    if (!t) return;
    // Auto-derive orientation from dimensions so the dropdown stays in sync
    // when the user types width/height directly. Square stays as-is.
    const orientation: 'portrait' | 'landscape' =
      width_mm > height_mm
        ? 'landscape'
        : width_mm < height_mm
          ? 'portrait'
          : t.orientation;
    set({
      template: {
        ...t,
        width_mm,
        height_mm,
        orientation,
        updatedAt: new Date().toISOString(),
      },
    });
    get().pushHistory();
  },

  select: (ids) => set({ selectedIds: ids }),
  toggleSelect: (id) => {
    const { selectedIds } = get();
    set({
      selectedIds: selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    });
  },

  addElement: (type, x_mm, y_mm, overrides) => {
    const t = get().template;
    if (!t) return;
    const maxZ = t.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const el = {
      ...defaultElement(type),
      ...(overrides ?? {}),
      id: uid(),
      x_mm,
      y_mm,
      zIndex: maxZ + 1,
    } as TemplateElement;
    set({
      template: { ...t, elements: [...t.elements, el], updatedAt: new Date().toISOString() },
      selectedIds: [el.id],
    });
    get().pushHistory();
  },

  updateElement: (id, patch) => {
    const t = get().template;
    if (!t) return;
    const elements = t.elements.map((e) =>
      e.id === id ? ({ ...e, ...patch } as TemplateElement) : e,
    );
    set({ template: { ...t, elements, updatedAt: new Date().toISOString() } });
  },

  removeSelected: () => {
    const t = get().template;
    if (!t) return;
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set({
      template: {
        ...t,
        elements: t.elements.filter((e) => !selectedIds.includes(e.id)),
        updatedAt: new Date().toISOString(),
      },
      selectedIds: [],
    });
    get().pushHistory();
  },

  clearAllElements: () => {
    const t = get().template;
    if (!t) return;
    if (t.elements.length === 0) return;
    set({
      template: { ...t, elements: [], updatedAt: new Date().toISOString() },
      selectedIds: [],
    });
    get().pushHistory();
  },

  duplicateSelected: () => {
    const t = get().template;
    if (!t) return;
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    const maxZ = t.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const dups: TemplateElement[] = [];
    let z = maxZ;
    t.elements.forEach((e) => {
      if (selectedIds.includes(e.id)) {
        z += 1;
        dups.push({
          ...e,
          id: uid(),
          x_mm: e.x_mm + 2,
          y_mm: e.y_mm + 2,
          zIndex: z,
        } as TemplateElement);
      }
    });
    set({
      template: {
        ...t,
        elements: [...t.elements, ...dups],
        updatedAt: new Date().toISOString(),
      },
      selectedIds: dups.map((d) => d.id),
    });
    get().pushHistory();
  },

  bringToFront: (id) => {
    const t = get().template;
    if (!t) return;
    const maxZ = t.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    get().updateElement(id, { zIndex: maxZ + 1 } as Partial<TemplateElement>);
    get().pushHistory();
  },

  sendToBack: (id) => {
    const t = get().template;
    if (!t) return;
    const minZ = t.elements.reduce((m, e) => Math.min(m, e.zIndex), Infinity);
    get().updateElement(id, { zIndex: minZ - 1 } as Partial<TemplateElement>);
    get().pushHistory();
  },

  toggleLock: (id) => {
    const t = get().template;
    if (!t) return;
    const el = t.elements.find((e) => e.id === id);
    if (!el) return;
    get().updateElement(id, { locked: !el.locked } as Partial<TemplateElement>);
    get().pushHistory();
  },

  reorderElement: (id, direction) => {
    const t = get().template;
    if (!t) return;
    const sorted = [...t.elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const swap = direction === 'up' ? idx + 1 : idx - 1;
    if (swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx]!;
    const b = sorted[swap]!;
    const aZ = a.zIndex;
    a.zIndex = b.zIndex;
    b.zIndex = aZ;
    set({
      template: { ...t, elements: [...t.elements], updatedAt: new Date().toISOString() },
    });
    get().pushHistory();
  },

  reorderLayer: (fromIndex, toIndex) => {
    const t = get().template;
    if (!t) return;
    // Top-most-first matches the order shown in the Layers panel.
    const sorted = [...t.elements].sort((a, b) => b.zIndex - a.zIndex);
    if (fromIndex < 0 || fromIndex >= sorted.length) return;
    if (toIndex < 0 || toIndex > sorted.length) return;
    // Drop directly above or below the dragged row → no movement.
    if (toIndex === fromIndex || toIndex === fromIndex + 1) return;
    const [moved] = sorted.splice(fromIndex, 1);
    if (!moved) return;
    const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
    sorted.splice(insertAt, 0, moved);
    // Reassign zIndex sequentially: top of list = highest zIndex.
    const n = sorted.length;
    const byId = new Map(sorted.map((el, i) => [el.id, n - i]));
    const elements = t.elements.map((e) =>
      byId.has(e.id) ? ({ ...e, zIndex: byId.get(e.id)! } as TemplateElement) : e,
    );
    set({
      template: { ...t, elements, updatedAt: new Date().toISOString() },
    });
    get().pushHistory();
  },

  alignSelected: (mode) => {
    const t = get().template;
    if (!t) return;
    const { selectedIds } = get();
    if (selectedIds.length < 2) return;
    const sel = t.elements.filter((e) => selectedIds.includes(e.id));
    const bb = unionBounds(sel);
    if (!bb) return;
    const elements = t.elements.map((e) => {
      if (!selectedIds.includes(e.id)) return e;
      switch (mode) {
        case 'left':
          return { ...e, x_mm: bb.x } as TemplateElement;
        case 'right':
          return { ...e, x_mm: bb.x + bb.width - e.width_mm } as TemplateElement;
        case 'center':
          return { ...e, x_mm: bb.x + (bb.width - e.width_mm) / 2 } as TemplateElement;
        case 'top':
          return { ...e, y_mm: bb.y } as TemplateElement;
        case 'bottom':
          return { ...e, y_mm: bb.y + bb.height - e.height_mm } as TemplateElement;
        case 'middle':
          return { ...e, y_mm: bb.y + (bb.height - e.height_mm) / 2 } as TemplateElement;
      }
    });
    set({
      template: { ...t, elements, updatedAt: new Date().toISOString() },
    });
    get().pushHistory();
  },

  distributeSelected: (axis) => {
    const t = get().template;
    if (!t) return;
    const { selectedIds } = get();
    if (selectedIds.length < 3) return;
    const sel = t.elements.filter((e) => selectedIds.includes(e.id));
    // Sort by leading edge along the chosen axis, then keep the outer two
    // pinned and re-space everything in between with equal gaps.
    const sorted = [...sel].sort((a, b) =>
      axis === 'horizontal' ? a.x_mm - b.x_mm : a.y_mm - b.y_mm,
    );
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const totalSize = sorted.reduce(
      (sum, e) => sum + (axis === 'horizontal' ? e.width_mm : e.height_mm),
      0,
    );
    const span =
      axis === 'horizontal'
        ? last.x_mm + last.width_mm - first.x_mm
        : last.y_mm + last.height_mm - first.y_mm;
    const gap = (span - totalSize) / (sorted.length - 1);
    const newPos = new Map<string, number>();
    let cursor = axis === 'horizontal' ? first.x_mm : first.y_mm;
    for (const e of sorted) {
      newPos.set(e.id, cursor);
      cursor += (axis === 'horizontal' ? e.width_mm : e.height_mm) + gap;
    }
    const elements = t.elements.map((e) => {
      const p = newPos.get(e.id);
      if (p === undefined) return e;
      return axis === 'horizontal'
        ? ({ ...e, x_mm: p } as TemplateElement)
        : ({ ...e, y_mm: p } as TemplateElement);
    });
    set({
      template: { ...t, elements, updatedAt: new Date().toISOString() },
    });
    get().pushHistory();
  },

  resizeSelectionBoundingBox: (snapshot, scaleX, scaleY, anchor) => {
    const t = get().template;
    if (!t) return;
    if (snapshot.length === 0) return;
    const bb = unionBounds(snapshot.map((s) => ({
      x_mm: s.x_mm,
      y_mm: s.y_mm,
      width_mm: s.width_mm,
      height_mm: s.height_mm,
    })));
    if (!bb) return;
    // Anchor point = the corner/edge that stays put. Edge anchors collapse
    // one axis to the centerline of the bounding box.
    const ax =
      anchor === 'top-left' || anchor === 'left' || anchor === 'bottom-left'
        ? bb.x
        : anchor === 'top-right' || anchor === 'right' || anchor === 'bottom-right'
          ? bb.x + bb.width
          : bb.x + bb.width / 2;
    const ay =
      anchor === 'top-left' || anchor === 'top' || anchor === 'top-right'
        ? bb.y
        : anchor === 'bottom-left' || anchor === 'bottom' || anchor === 'bottom-right'
          ? bb.y + bb.height
          : bb.y + bb.height / 2;
    const byId = new Map(snapshot.map((s) => [s.id, s]));
    const elements = t.elements.map((e) => {
      const s = byId.get(e.id);
      if (!s) return e;
      const newX = ax + (s.x_mm - ax) * scaleX;
      const newY = ay + (s.y_mm - ay) * scaleY;
      const newW = Math.max(0.5, s.width_mm * Math.abs(scaleX));
      const newH = Math.max(0.5, s.height_mm * Math.abs(scaleY));
      return {
        ...e,
        x_mm: newX,
        y_mm: newY,
        width_mm: newW,
        height_mm: newH,
      } as TemplateElement;
    });
    set({
      template: { ...t, elements, updatedAt: new Date().toISOString() },
    });
  },

  setZoom: (zoom) => set({ zoom }),
  toggleSnap: () => set({ snap: !get().snap }),
  setCursorMm: (x, y) => set({ cursorMm: { x, y } }),

  pushHistory: () => {
    const t = get().template;
    if (!t) return;
    const { history, historyIndex, version, savedVersion } = get();
    const trimmed = history.slice(0, historyIndex + 1);
    const next = [...trimmed, structuredClone(t)];
    const overflow = Math.max(0, next.length - HISTORY_LIMIT);
    const nextVersion = version + 1;
    set({
      history: next.slice(overflow),
      historyIndex: next.length - 1 - overflow,
      version: nextVersion,
      isDirty: nextVersion !== savedVersion,
    });
  },

  undo: () => {
    const { history, historyIndex, version, savedVersion } = get();
    if (historyIndex <= 0) return;
    const target = history[historyIndex - 1]!;
    const nextVersion = version + 1;
    set({
      template: structuredClone(target),
      historyIndex: historyIndex - 1,
      selectedIds: [],
      version: nextVersion,
      isDirty: nextVersion !== savedVersion,
    });
  },

  redo: () => {
    const { history, historyIndex, version, savedVersion } = get();
    if (historyIndex >= history.length - 1) return;
    const target = history[historyIndex + 1]!;
    const nextVersion = version + 1;
    set({
      template: structuredClone(target),
      historyIndex: historyIndex + 1,
      selectedIds: [],
      version: nextVersion,
      isDirty: nextVersion !== savedVersion,
    });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
}));
