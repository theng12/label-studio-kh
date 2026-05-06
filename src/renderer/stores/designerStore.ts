import { create } from 'zustand';
import type { Template, TemplateElement, ElementType } from '../../shared/types/template';
import { defaultElement } from '../designer/elementDefaults';

interface DesignerState {
  template: Template | null;
  selectedIds: string[];
  zoom: 'fit' | 1 | 2 | 3 | 4;
  snap: boolean;
  cursorMm: { x: number; y: number };

  history: Template[];
  historyIndex: number;

  setTemplate: (t: Template) => void;
  patchTemplate: (patch: Partial<Template>) => void;
  setOrientation: (orientation: 'portrait' | 'landscape') => void;
  setDimensions: (width_mm: number, height_mm: number) => void;

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;

  addElement: (type: ElementType, x_mm: number, y_mm: number) => void;
  updateElement: (id: string, patch: Partial<TemplateElement>) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  reorderElement: (id: string, direction: 'up' | 'down') => void;

  setZoom: (z: 'fit' | 1 | 2 | 3 | 4) => void;
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

  setTemplate: (template) => {
    set({
      template,
      selectedIds: [],
      history: [structuredClone(template)],
      historyIndex: 0,
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

  addElement: (type, x_mm, y_mm) => {
    const t = get().template;
    if (!t) return;
    const maxZ = t.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const el = {
      ...defaultElement(type),
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

  setZoom: (zoom) => set({ zoom }),
  toggleSnap: () => set({ snap: !get().snap }),
  setCursorMm: (x, y) => set({ cursorMm: { x, y } }),

  pushHistory: () => {
    const t = get().template;
    if (!t) return;
    const { history, historyIndex } = get();
    const trimmed = history.slice(0, historyIndex + 1);
    const next = [...trimmed, structuredClone(t)];
    const overflow = Math.max(0, next.length - HISTORY_LIMIT);
    set({ history: next.slice(overflow), historyIndex: next.length - 1 - overflow });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const target = history[historyIndex - 1]!;
    set({
      template: structuredClone(target),
      historyIndex: historyIndex - 1,
      selectedIds: [],
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const target = history[historyIndex + 1]!;
    set({
      template: structuredClone(target),
      historyIndex: historyIndex + 1,
      selectedIds: [],
    });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
}));
