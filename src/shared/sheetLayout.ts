// N-up sheet layout — tiling multiple labels onto a single A4/Letter page
// for office laser/inkjet sheet printers (vs one-label-per-page on a
// thermal/roll printer). Shared between the renderer (live "X per page"
// hint + controls) and the main process (actual rendering) so the grid
// math has a single source of truth.

export type SheetPageSize = 'A4' | 'Letter';
export type SheetOrientation = 'portrait' | 'landscape';

export interface SheetLayout {
  pageSize: SheetPageSize;
  orientation: SheetOrientation;
  /** Outer page margin in mm (same on all four sides). */
  marginMm: number;
  /** Gap between adjacent labels in mm (both axes). */
  gapMm: number;
  /** Optional manual column override. When undefined, auto-fit. */
  columns?: number;
  /** Optional manual row override. When undefined, auto-fit. */
  rows?: number;
}

export const DEFAULT_SHEET_LAYOUT: SheetLayout = {
  pageSize: 'A4',
  orientation: 'portrait',
  marginMm: 8,
  gapMm: 2,
};

// Physical page dimensions in mm (portrait, before any orientation swap).
const PAGE_DIMS_MM: Record<SheetPageSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  Letter: { w: 215.9, h: 279.4 },
};

export interface ComputedGrid {
  /** Page dimensions in mm AFTER applying orientation. */
  pageW: number;
  pageH: number;
  columns: number;
  rows: number;
  perPage: number;
  /** True when the label simply can't fit even one per page at this
   *  margin (UI should warn + disable). */
  tooBig: boolean;
}

/**
 * Compute how many WxH-mm labels fit on the configured sheet. Auto-fits
 * unless the layout pins columns/rows. Always returns at least a 1×1 grid
 * (with tooBig=true) so callers can render a warning rather than divide by
 * zero.
 */
export function computeSheetGrid(
  labelWmm: number,
  labelHmm: number,
  layout: SheetLayout,
): ComputedGrid {
  const base = PAGE_DIMS_MM[layout.pageSize];
  const pageW = layout.orientation === 'landscape' ? base.h : base.w;
  const pageH = layout.orientation === 'landscape' ? base.w : base.h;

  const usableW = pageW - layout.marginMm * 2;
  const usableH = pageH - layout.marginMm * 2;

  // How many fit with `gap` between cells:  n cells + (n-1) gaps <= usable
  //   →  n <= (usable + gap) / (cell + gap)
  const fitCols = Math.floor((usableW + layout.gapMm) / (labelWmm + layout.gapMm));
  const fitRows = Math.floor((usableH + layout.gapMm) / (labelHmm + layout.gapMm));

  const tooBig = fitCols < 1 || fitRows < 1;

  const columns = Math.max(
    1,
    layout.columns && layout.columns > 0 ? layout.columns : fitCols || 1,
  );
  const rows = Math.max(
    1,
    layout.rows && layout.rows > 0 ? layout.rows : fitRows || 1,
  );

  return {
    pageW,
    pageH,
    columns,
    rows,
    perPage: columns * rows,
    tooBig,
  };
}
