// Standard CSV columns recognised by Label Studio KH (per spec §4.5).
// The canonical key on the left stays `sku` (legacy internal name); the
// CSV-facing header is "Product Code" (set in the sample workbook + the
// ALIASES map). Same idea for product_name → "Product Name", etc.
export const STANDARD_COLUMNS = [
  // Identity + classification
  'sku',
  'secondary_code',
  'product_name',
  'brand',
  'barcode',
  'description',
  'category',
  'variant_attributes',
  'unit',                 // "Unit of Measure"
  // Legacy columns kept for backward compat with older CSVs / Generate flow
  'variant',
  'unit_qty',
  'unit_word',
  'product_url',
  'product_image_path',
  'date',
  'notes',
  // v7: round-trip with external inventory/POS systems
  'expiry_date',
  'tax_rate',
  'reorder_point',
  'reorder_quantity',
  'track_inventory',
  // Prices — one column per default price group. The legacy "extra_json"
  // catch-all in ImportService.commit() picks these up automatically;
  // listing them here just makes them appear in the column-mapping UI.
  'cost_price',
  'selling_price',
  'wholesale_price',
  'min_selling_price',
] as const;

export type StandardColumn = (typeof STANDARD_COLUMNS)[number];

export const REQUIRED_COLUMNS: StandardColumn[] = ['sku', 'product_name', 'brand'];

export interface ParsedFile {
  columns: string[];
  rows: Record<string, string>[];
  source: string; // filename
}

export interface ColumnMapping {
  // standardField → sourceColumnName (or null if unmapped)
  [standardField: string]: string | null;
}

export interface ValidationResult {
  okRowCount: number;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  duplicateSkusInFile: string[];
}

export interface ValidationIssue {
  rowIndex: number; // 0-based
  field?: string;
  message: string;
}

export interface SkuConflict {
  sku: string;
  existing: { brandId: string; productName: string | null };
  incoming: { productName: string | null };
}

export type DedupAction = 'skip' | 'overwrite' | 'new_version';

export interface CommitInput {
  brandId: string;
  sourceFilename: string;
  mapping: ColumnMapping;
  rows: Record<string, string>[];
  defaultAction: DedupAction;
  perSkuActions?: Record<string, DedupAction>;
}

export interface CommitResult {
  importId: string;
  inserted: number;
  overwritten: number;
  skipped: number;
  newVersions: number;
}
