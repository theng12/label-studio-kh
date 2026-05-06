import { getDb } from './Database';
import type { SkuRow } from './ImportService';

export interface SkuInput {
  sku: string;
  brand_id: string;
  product_name?: string | null;
  barcode?: string | null;
  description?: string | null;
  variant?: string | null;
  unit_qty?: string | null;
  unit_word?: string | null;
  product_url?: string | null;
  product_image_path?: string | null;
  date?: string | null;
  notes?: string | null;
  extra_json?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const SkuService = {
  get(brandId: string, sku: string): SkuRow | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT sku, brand_id, product_name, barcode, description, variant,
                unit_qty, unit_word, product_url, product_image_path, date, notes, extra_json
         FROM skus
         WHERE brand_id = ? AND sku = ?`,
      )
      .get(brandId, sku) as SkuRow | undefined;
    return row ?? null;
  },

  upsert(input: SkuInput): SkuRow | null {
    if (!input.sku.trim() || !input.brand_id) return null;
    const db = getDb();

    db.prepare(
      `INSERT INTO skus (
         sku, brand_id, product_name, barcode, description, variant, unit_qty,
         unit_word, product_url, product_image_path, date, notes, extra_json,
         created_at, updated_at
       ) VALUES (
         @sku, @brand_id, @product_name, @barcode, @description, @variant, @unit_qty,
         @unit_word, @product_url, @product_image_path, @date, @notes, @extra_json,
         @created_at, @updated_at
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
         updated_at          = excluded.updated_at`,
    ).run({
      sku: input.sku.trim(),
      brand_id: input.brand_id,
      product_name: input.product_name ?? null,
      barcode: input.barcode ?? null,
      description: input.description ?? null,
      variant: input.variant ?? null,
      unit_qty: input.unit_qty ?? null,
      unit_word: input.unit_word ?? null,
      product_url: input.product_url ?? null,
      product_image_path: input.product_image_path ?? null,
      date: input.date ?? null,
      notes: input.notes ?? null,
      extra_json: input.extra_json ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    return SkuService.get(input.brand_id, input.sku.trim());
  },

  delete(brandId: string, sku: string): boolean {
    const db = getDb();
    const result = db
      .prepare(`DELETE FROM skus WHERE brand_id = ? AND sku = ?`)
      .run(brandId, sku);
    return result.changes > 0;
  },
};
