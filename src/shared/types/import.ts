// Standard CSV columns recognised by Label Studio KH (per spec §4.5).
export const STANDARD_COLUMNS = [
  'sku',
  'product_name',
  'brand',
  'barcode',
  'description',
  'variant',
  'unit_qty',
  'unit_word',
  'product_url',
  'product_image_path',
  'date',
  'notes',
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
