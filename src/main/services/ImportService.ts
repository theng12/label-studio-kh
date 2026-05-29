import { readFileSync } from 'node:fs';
import { extname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { getDb } from './Database';
import { AuditService } from './AuditService';
import { BrandService } from './BrandService';
import {
  STANDARD_COLUMNS,
  REQUIRED_COLUMNS,
  type ColumnMapping,
  type CommitInput,
  type CommitResult,
  type ParsedFile,
  type SkuConflict,
  type ValidationResult,
} from '@shared/types/import';

function nowIso(): string {
  return new Date().toISOString();
}

// ── Parse ────────────────────────────────────────────────────────────────────

export function parseFile(filePath: string): ParsedFile {
  const ext = extname(filePath).toLowerCase();
  const source = basename(filePath);

  if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = Papa.parse<Record<string, string>>(raw, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    return {
      columns: parsed.meta.fields ?? [],
      rows: parsed.data,
      source,
    };
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.readFile(filePath, { cellDates: false });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return { columns: [], rows: [], source };
    const sheet = wb.Sheets[firstSheetName]!;
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      raw: false,
      defval: '',
    });
    const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
    return { columns, rows, source };
  }

  throw new Error(`Unsupported file extension: ${ext}`);
}

// ── Auto-map columns ─────────────────────────────────────────────────────────

// Source-column → standard-column. Keys are already normalised (lowercase,
// `[\s-]` → `_`) so the autoMap walker can index directly. To add a new
// header alias, write it in the normalised form (e.g. "Reorder Point" →
// `reorder_point`).
const ALIASES: Record<string, string> = {
  // sku (UI labels this "Product Code")
  sku: 'sku',
  sku_code: 'sku',
  productid: 'sku',
  product_id: 'sku',
  product_code: 'sku',
  // secondary_code
  secondary_code: 'secondary_code',
  sec_code: 'secondary_code',
  supplier_code: 'secondary_code',
  alt_sku: 'secondary_code',
  // product_name (UI labels this "Product Name")
  product_name: 'product_name',
  product: 'product_name',
  productname: 'product_name',
  name: 'product_name',
  title: 'product_name',
  // brand (UI labels this "Brand Name")
  brand: 'brand',
  brand_name: 'brand',
  brandname: 'brand',
  // barcode
  barcode: 'barcode',
  ean: 'barcode',
  ean13: 'barcode',
  upc: 'barcode',
  // description
  description: 'description',
  desc: 'description',
  // category (UI labels this "Category Name")
  category: 'category',
  category_name: 'category',
  // unit (UI labels this "Unit of Measure" — the Product Library column,
  // not the legacy `unit_word` which still has its own aliases below for
  // backward-compat with old QR-label CSVs).
  unit_of_measure: 'unit',
  uom: 'unit',
  // variant_attributes
  variant_attributes: 'variant_attributes',
  attributes: 'variant_attributes',
  // legacy 'variant' field (older QR-label CSVs)
  variant: 'variant',
  color: 'variant',
  colour: 'variant',
  finish: 'variant',
  size: 'variant',
  // unit_qty (legacy)
  unit_qty: 'unit_qty',
  qty: 'unit_qty',
  quantity: 'unit_qty',
  // unit_word (legacy)
  unit_word: 'unit_word',
  unit: 'unit_word',
  // product_url
  product_url: 'product_url',
  url: 'product_url',
  link: 'product_url',
  // product_image_path
  product_image_path: 'product_image_path',
  image: 'product_image_path',
  image_path: 'product_image_path',
  photo: 'product_image_path',
  // date
  date: 'date',
  // notes
  notes: 'notes',
  note: 'notes',
  // v7 — inventory & lifecycle
  expiry_date: 'expiry_date',
  expiry: 'expiry_date',
  expires: 'expiry_date',
  expiration: 'expiry_date',
  expiration_date: 'expiry_date',
  tax_rate: 'tax_rate',
  tax: 'tax_rate',
  vat: 'tax_rate',
  vat_rate: 'tax_rate',
  reorder_point: 'reorder_point',
  min_stock: 'reorder_point',
  reorder_quantity: 'reorder_quantity',
  reorder_qty: 'reorder_quantity',
  track_inventory: 'track_inventory',
  inventory_tracked: 'track_inventory',
  stock_tracked: 'track_inventory',
  // Prices — these flow into product.prices JSON via the commit-time
  // assembly below.
  cost_price: 'cost_price',
  cost: 'cost_price',
  selling_price: 'selling_price',
  retail: 'selling_price', // back-compat with old "Retail" group name
  retail_price: 'selling_price',
  price: 'selling_price',
  wholesale_price: 'wholesale_price',
  wholesale: 'wholesale_price',
  min_selling_price: 'min_selling_price',
  min_price: 'min_selling_price',
};

export function autoMap(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const std of STANDARD_COLUMNS) mapping[std] = null;

  for (const col of columns) {
    const key = col.trim().toLowerCase().replace(/[\s-]/g, '_');
    const std = ALIASES[key];
    if (std && mapping[std] === null) {
      mapping[std] = col;
    }
  }
  return mapping;
}

// ── Validate ─────────────────────────────────────────────────────────────────

export function validate(rows: Record<string, string>[], mapping: ColumnMapping): ValidationResult {
  const result: ValidationResult = {
    okRowCount: 0,
    warnings: [],
    errors: [],
    duplicateSkusInFile: [],
  };

  // Check required columns are mapped
  for (const req of REQUIRED_COLUMNS) {
    if (!mapping[req]) {
      result.errors.push({
        rowIndex: -1,
        field: req,
        message: `Required column "${req}" is not mapped.`,
      });
    }
  }

  if (result.errors.length > 0) return result;

  const skuColumn = mapping['sku']!;
  const seenSkus = new Set<string>();
  const dupSkus = new Set<string>();

  rows.forEach((row, idx) => {
    let rowOk = true;
    const sku = String(row[skuColumn] ?? '').trim();
    if (!sku) {
      result.errors.push({ rowIndex: idx, field: 'sku', message: 'Missing SKU.' });
      rowOk = false;
    } else if (seenSkus.has(sku)) {
      dupSkus.add(sku);
      result.warnings.push({
        rowIndex: idx,
        field: 'sku',
        message: `Duplicate SKU "${sku}" within this file.`,
      });
    } else {
      seenSkus.add(sku);
    }

    const productNameCol = mapping['product_name'];
    if (productNameCol) {
      const v = String(row[productNameCol] ?? '').trim();
      if (!v) {
        result.warnings.push({
          rowIndex: idx,
          field: 'product_name',
          message: 'Empty product name.',
        });
      }
    }

    const barcodeCol = mapping['barcode'];
    if (barcodeCol) {
      const v = String(row[barcodeCol] ?? '').trim();
      if (v && !/^[0-9A-Za-z\-]{4,}$/.test(v)) {
        result.warnings.push({
          rowIndex: idx,
          field: 'barcode',
          message: `Barcode "${v}" looks unusual.`,
        });
      }
    }

    if (rowOk) result.okRowCount += 1;
  });

  result.duplicateSkusInFile = [...dupSkus];
  return result;
}

// ── Find duplicates against existing DB ──────────────────────────────────────

export function findConflicts(
  brandId: string,
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): SkuConflict[] {
  const skuCol = mapping['sku'];
  const productNameCol = mapping['product_name'];
  if (!skuCol) return [];

  const db = getDb();
  const stmt = db.prepare(
    'SELECT sku, brand_id, product_name FROM skus WHERE brand_id = ? AND sku = ?',
  );

  const conflicts: SkuConflict[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const sku = String(row[skuCol] ?? '').trim();
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);

    const existing = stmt.get(brandId, sku) as
      | { sku: string; brand_id: string; product_name: string | null }
      | undefined;

    if (existing) {
      conflicts.push({
        sku,
        existing: {
          brandId: existing.brand_id,
          productName: existing.product_name,
        },
        incoming: {
          productName: productNameCol
            ? String(row[productNameCol] ?? '').trim() || null
            : null,
        },
      });
    }
  }

  return conflicts;
}

// ── Commit ───────────────────────────────────────────────────────────────────

export function commit(input: CommitInput): CommitResult {
  const db = getDb();
  const { brandId, mapping, rows, defaultAction, perSkuActions = {}, sourceFilename } = input;

  const importId = randomUUID();

  const m = (field: string) => mapping[field];

  const insert = db.prepare(`
    INSERT INTO skus (
      sku, brand_id, product_name, barcode, description, variant, unit_qty,
      unit_word, product_url, product_image_path, date, notes, extra_json,
      secondary_code, category, unit, prices, variant_attributes,
      expiry_date, tax_rate, reorder_point, reorder_quantity, track_inventory,
      last_import_id, created_at, updated_at
    ) VALUES (
      @sku, @brand_id, @product_name, @barcode, @description, @variant, @unit_qty,
      @unit_word, @product_url, @product_image_path, @date, @notes, @extra_json,
      @secondary_code, @category, @unit, @prices, @variant_attributes,
      @expiry_date, @tax_rate, @reorder_point, @reorder_quantity, @track_inventory,
      @last_import_id, @created_at, @updated_at
    )
    ON CONFLICT(sku, brand_id) DO UPDATE SET
      product_name        = excluded.product_name,
      barcode             = excluded.barcode,
      description         = excluded.description,
      variant             = excluded.variant,
      unit_qty            = excluded.unit_qty,
      unit_word           = excluded.unit_word,
      product_url         = excluded.product_url,
      product_image_path  = excluded.product_image_path,
      date                = excluded.date,
      notes               = excluded.notes,
      extra_json          = excluded.extra_json,
      secondary_code      = COALESCE(excluded.secondary_code, secondary_code),
      category            = COALESCE(excluded.category, category),
      unit                = COALESCE(excluded.unit, unit),
      prices              = excluded.prices,
      variant_attributes  = COALESCE(excluded.variant_attributes, variant_attributes),
      expiry_date         = COALESCE(excluded.expiry_date, expiry_date),
      tax_rate            = COALESCE(excluded.tax_rate, tax_rate),
      reorder_point       = COALESCE(excluded.reorder_point, reorder_point),
      reorder_quantity    = COALESCE(excluded.reorder_quantity, reorder_quantity),
      track_inventory     = excluded.track_inventory,
      last_import_id      = excluded.last_import_id,
      updated_at          = excluded.updated_at
  `);

  // Existing-product lookup so we can MERGE the prices JSON (don't blank
  // unmapped tiers) and preserve unmapped scalar fields per spec §11 (the
  // "imports never overwrite a populated field with null" invariant).
  const readExistingForMerge = db.prepare(
    'SELECT prices FROM skus WHERE sku = ? AND brand_id = ?',
  );

  const checkExisting = db.prepare(
    'SELECT 1 FROM skus WHERE sku = ? AND brand_id = ?',
  );

  let inserted = 0;
  let overwritten = 0;
  let skipped = 0;
  let newVersions = 0;

  const tx = db.transaction((rs: Record<string, string>[]) => {
    for (const row of rs) {
      const skuCol = m('sku');
      if (!skuCol) continue;
      let sku = String(row[skuCol] ?? '').trim();
      if (!sku) continue;

      const existing = checkExisting.get(sku, brandId);
      const action = perSkuActions[sku] ?? defaultAction;

      if (existing) {
        if (action === 'skip') {
          skipped += 1;
          continue;
        }
        if (action === 'new_version') {
          sku = `${sku}-v2`;
          newVersions += 1;
        } else {
          overwritten += 1;
        }
      } else {
        inserted += 1;
      }

      // Collect any non-mapped columns into extra_json so user-defined columns
      // are preserved (per spec §4.5: "never deletes unknown columns").
      const knownSourceCols = new Set(
        Object.values(mapping).filter((v): v is string => Boolean(v)),
      );
      const extra: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!knownSourceCols.has(key) && value !== undefined && value !== '') {
          extra[key] = String(value);
        }
      }

      // Assemble the prices JSON from the four named price columns. Each
      // empty/unmapped value is dropped (so re-importing without that
      // column leaves the existing tier untouched via the merge below).
      const incomingPrices: Record<string, string> = {};
      const priceMap: Array<[string, string]> = [
        ['cost_price', 'Cost'],
        ['selling_price', 'Selling'],
        ['wholesale_price', 'Wholesale'],
        ['min_selling_price', 'Min Selling'],
      ];
      for (const [stdKey, groupName] of priceMap) {
        const col = m(stdKey);
        if (!col) continue;
        const raw = String(row[col] ?? '').trim();
        if (!raw) continue;
        incomingPrices[groupName] = raw;
      }

      // MERGE prices with existing so a CSV that only carries one price
      // column doesn't blank the others (matches the AGENTS.md §11 import
      // invariant: "never blank a populated field on missing column").
      let existingPrices: Record<string, string> = {};
      const existingRow = readExistingForMerge.get(sku, brandId) as
        | { prices: string }
        | undefined;
      if (existingRow?.prices) {
        try {
          existingPrices = JSON.parse(existingRow.prices) as Record<
            string,
            string
          >;
        } catch {
          /* ignore malformed JSON */
        }
      }
      const mergedPrices = { ...existingPrices, ...incomingPrices };

      // Track-inventory normalisation — accept yes/no/true/false/1/0/y/n.
      const trackInvCol = m('track_inventory');
      const trackInvRaw = trackInvCol
        ? String(row[trackInvCol] ?? '').trim().toLowerCase()
        : '';
      const trackInventory = ['1', 'true', 'yes', 'y', 'on'].includes(
        trackInvRaw,
      )
        ? 1
        : 0;

      insert.run({
        sku,
        brand_id: brandId,
        product_name: m('product_name') ? row[m('product_name')!] ?? null : null,
        barcode: m('barcode') ? row[m('barcode')!] ?? null : null,
        description: m('description') ? row[m('description')!] ?? null : null,
        variant: m('variant') ? row[m('variant')!] ?? null : null,
        unit_qty: m('unit_qty') ? row[m('unit_qty')!] ?? null : null,
        unit_word: m('unit_word') ? row[m('unit_word')!] ?? null : null,
        product_url: m('product_url') ? row[m('product_url')!] ?? null : null,
        product_image_path: m('product_image_path')
          ? row[m('product_image_path')!] ?? null
          : null,
        date: m('date') ? row[m('date')!] ?? null : null,
        notes: m('notes') ? row[m('notes')!] ?? null : null,
        extra_json: Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
        // v4+ Product-Library columns the importer now also writes
        secondary_code: m('secondary_code')
          ? row[m('secondary_code')!] ?? null
          : null,
        category: m('category') ? row[m('category')!] ?? null : null,
        unit: m('unit') ? row[m('unit')!] ?? null : null,
        prices: JSON.stringify(mergedPrices),
        // v7 inventory & lifecycle
        variant_attributes: m('variant_attributes')
          ? row[m('variant_attributes')!] ?? null
          : null,
        expiry_date: m('expiry_date') ? row[m('expiry_date')!] ?? null : null,
        tax_rate: m('tax_rate') ? row[m('tax_rate')!] ?? null : null,
        reorder_point: m('reorder_point')
          ? row[m('reorder_point')!] ?? null
          : null,
        reorder_quantity: m('reorder_quantity')
          ? row[m('reorder_quantity')!] ?? null
          : null,
        track_inventory: trackInventory,
        last_import_id: importId,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    }
  });

  tx(rows);

  db.prepare(
    `INSERT INTO imports (id, source_filename, brand_id, row_count, warnings_count, errors_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(importId, sourceFilename, brandId, rows.length, 0, 0, nowIso());

  // Audit: one summary event per import so it shows in the global History
  // feed alongside individual product edits. Company resolved from the
  // target brand.
  const brand = BrandService.get(brandId);
  AuditService.log({
    entityType: 'import',
    entityId: importId,
    companyId: brand?.companyId ?? null,
    action: 'import',
    summary: `Imported ${sourceFilename ?? 'a file'} into ${brand?.name ?? 'a brand'} — ${inserted} new, ${overwritten} updated${skipped ? `, ${skipped} skipped` : ''}`,
    after: { inserted, overwritten, skipped, newVersions, rowCount: rows.length },
  });

  return { importId, inserted, overwritten, skipped, newVersions };
}

// ── List for use as a generation data source ─────────────────────────────────

export interface SkuRow {
  sku: string;
  brand_id: string;
  product_name: string | null;
  barcode: string | null;
  description: string | null;
  variant: string | null;
  unit_qty: string | null;
  unit_word: string | null;
  product_url: string | null;
  product_image_path: string | null;
  date: string | null;
  notes: string | null;
  extra_json: string | null;
}

export function listSkusForBrand(brandId: string): SkuRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT sku, brand_id, product_name, barcode, description, variant,
              unit_qty, unit_word, product_url, product_image_path, date, notes, extra_json
       FROM skus
       WHERE brand_id = ?
       ORDER BY sku`,
    )
    .all(brandId) as SkuRow[];
  return rows;
}

export function listImports(brandId?: string): Array<{
  id: string;
  source_filename: string | null;
  brand_id: string | null;
  row_count: number;
  created_at: string;
}> {
  const db = getDb();
  const rows = brandId
    ? db
        .prepare(
          'SELECT id, source_filename, brand_id, row_count, created_at FROM imports WHERE brand_id = ? ORDER BY created_at DESC LIMIT 100',
        )
        .all(brandId)
    : db
        .prepare(
          'SELECT id, source_filename, brand_id, row_count, created_at FROM imports ORDER BY created_at DESC LIMIT 100',
        )
        .all();
  return rows as Array<{
    id: string;
    source_filename: string | null;
    brand_id: string | null;
    row_count: number;
    created_at: string;
  }>;
}

/**
 * Delete a single import-history row. This is purely audit-log: the SKUs the
 * import inserted/updated remain untouched (they live in `skus` keyed by SKU
 * code, not by import). `skus.last_import_id` is left dangling, which is
 * fine — nothing reads it defensively against the imports table, and a
 * dangling string FK in SQLite without enforcement is harmless. Returns
 * true if the row existed.
 */
export function deleteImport(id: string): boolean {
  const db = getDb();
  const r = db.prepare('DELETE FROM imports WHERE id = ?').run(id);
  return r.changes > 0;
}

/**
 * Wipe every import-history row, optionally scoped to a single brand. Same
 * audit-log-only semantics as deleteImport(). Returns the number of rows
 * removed so the UI can show "Cleared N entries."
 */
export function clearImports(brandId?: string): number {
  const db = getDb();
  const r = brandId
    ? db.prepare('DELETE FROM imports WHERE brand_id = ?').run(brandId)
    : db.prepare('DELETE FROM imports').run();
  return r.changes;
}
