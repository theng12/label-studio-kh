import { create } from 'zustand';
import type {
  ColumnMapping,
  ParsedFile,
  SkuConflict,
  ValidationResult,
  DedupAction,
  CommitResult,
} from '../../shared/types/import';
import { generateEan13FromSeed } from '../../shared/format';

type Step = 'pickFile' | 'mapAndPreview' | 'dedup' | 'committing' | 'done';

interface ImportState {
  step: Step;
  brandId: string | null;
  parsed: ParsedFile | null;
  mapping: ColumnMapping;
  validation: ValidationResult | null;
  conflicts: SkuConflict[];
  defaultDedup: DedupAction;
  perSkuDedup: Record<string, DedupAction>;
  committing: boolean;
  result: CommitResult | null;
  error: string | null;

  setBrandId: (id: string) => void;
  reset: () => void;

  loadFile: (path: string) => Promise<void>;
  setMapping: (m: ColumnMapping) => void;
  setMappingField: (std: string, src: string | null) => void;
  validate: () => Promise<void>;
  fillMissingBarcodes: () => Promise<number>;
  goToDedup: () => Promise<void>;
  setDefaultDedup: (a: DedupAction) => void;
  setSkuDedup: (sku: string, a: DedupAction) => void;
  commit: () => Promise<void>;
  goBack: () => void;
}

const initial: Pick<
  ImportState,
  | 'step'
  | 'brandId'
  | 'parsed'
  | 'mapping'
  | 'validation'
  | 'conflicts'
  | 'defaultDedup'
  | 'perSkuDedup'
  | 'committing'
  | 'result'
  | 'error'
> = {
  step: 'pickFile',
  brandId: null,
  parsed: null,
  mapping: {},
  validation: null,
  conflicts: [],
  defaultDedup: 'skip',
  perSkuDedup: {},
  committing: false,
  result: null,
  error: null,
};

export const useImportStore = create<ImportState>((set, get) => ({
  ...initial,

  setBrandId: (id) => set({ brandId: id }),

  reset: () => set({ ...initial, brandId: get().brandId }),

  loadFile: async (path) => {
    set({ error: null });
    try {
      const parsed = await window.api.import.parseFile(path);
      const mapping = await window.api.import.autoMap(parsed.columns);
      set({ parsed, mapping, step: 'mapAndPreview' });
      const v = await window.api.import.validate(parsed.rows, mapping);
      set({ validation: v });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  setMapping: (m) => set({ mapping: m }),
  setMappingField: (std, src) =>
    set({ mapping: { ...get().mapping, [std]: src } }),

  validate: async () => {
    const { parsed, mapping } = get();
    if (!parsed) return;
    const v = await window.api.import.validate(parsed.rows, mapping);
    set({ validation: v });
  },

  /**
   * Fill any empty `barcode` cells with a valid EAN-13 code derived from the
   * row's SKU. Deterministic per SKU so re-running this on the same data
   * produces the same codes. Returns how many rows were filled.
   *
   * Mutates parsed.rows in place (since it's the working dataset). Triggers
   * a re-validate so the warnings list updates.
   */
  fillMissingBarcodes: async () => {
    const { parsed, mapping } = get();
    if (!parsed) return 0;
    const skuCol = mapping['sku'];
    let barcodeCol = mapping['barcode'];

    // If the file doesn't have a barcode column at all, add one and map it.
    let columns = parsed.columns;
    let mappingNext = mapping;
    if (!barcodeCol) {
      barcodeCol = 'barcode';
      columns = parsed.columns.includes('barcode')
        ? parsed.columns
        : [...parsed.columns, 'barcode'];
      mappingNext = { ...mapping, barcode: 'barcode' };
    }

    if (!skuCol) return 0;

    let filled = 0;
    const rows = parsed.rows.map((row) => {
      const existing = String(row[barcodeCol!] ?? '').trim();
      if (existing) return row;
      const sku = String(row[skuCol] ?? '').trim();
      if (!sku) return row;
      filled += 1;
      return { ...row, [barcodeCol!]: generateEan13FromSeed(sku) };
    });

    set({
      parsed: { ...parsed, columns, rows },
      mapping: mappingNext,
    });
    // Refresh validation so any 'looks unusual' warnings disappear.
    const v = await window.api.import.validate(rows, mappingNext);
    set({ validation: v });
    return filled;
  },

  goToDedup: async () => {
    const { brandId, parsed, mapping } = get();
    if (!brandId || !parsed) return;
    const conflicts = await window.api.import.findConflicts(
      brandId,
      parsed.rows,
      mapping,
    );
    set({ conflicts, step: 'dedup' });
  },

  setDefaultDedup: (a) => set({ defaultDedup: a }),
  setSkuDedup: (sku, a) =>
    set({ perSkuDedup: { ...get().perSkuDedup, [sku]: a } }),

  commit: async () => {
    const { brandId, parsed, mapping, defaultDedup, perSkuDedup } = get();
    if (!brandId || !parsed) return;
    set({ step: 'committing', committing: true, error: null });
    try {
      const result = await window.api.import.commit({
        brandId,
        sourceFilename: parsed.source,
        mapping,
        rows: parsed.rows,
        defaultAction: defaultDedup,
        perSkuActions: perSkuDedup,
      });
      set({ result, step: 'done', committing: false });
    } catch (err) {
      set({ error: String(err), committing: false, step: 'mapAndPreview' });
    }
  },

  goBack: () => {
    const { step } = get();
    if (step === 'mapAndPreview') set({ step: 'pickFile' });
    else if (step === 'dedup') set({ step: 'mapAndPreview' });
  },
}));
