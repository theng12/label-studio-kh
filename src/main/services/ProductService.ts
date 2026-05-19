// Product Library backend. Mirrors the spec at
// docs/PRODUCT_LIBRARY_HANDOFF.md §7, adapted to our schema:
//   - parent FK = brand_id (spec's company_id)
//   - data lives on the existing `skus` table (extended in schema v4),
//     not a new `products` table — preserves ImportService + Generate
//     + the generations FK relationship.
//   - row mapper exposes a Product shape; the legacy `skus` columns
//     (product_name, variant, unit_qty, unit_word, product_url,
//     product_image_path, date, notes, extra_json) are not part of the
//     Product surface but are not destroyed either.

import { randomUUID } from 'node:crypto';
import { getDb } from './Database';
import type {
  Product,
  ProductInput,
  ProductFilters,
  ProductPrices,
  ProductCustomFields,
  ProductStatus,
} from '@shared/types/product';
import { MAX_IMAGES_PER_PRODUCT } from '@shared/types/product';

// ── JSON + row mapping ──────────────────────────────────────────────────────

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

interface SkuRowFromDb {
  id: string | null;
  sku: string;
  brand_id: string;
  // legacy fields we ignore in the Product surface but tolerate in the row
  product_name: string | null;
  barcode: string | null;
  description: string | null;
  // v4 fields
  secondary_code: string | null;
  category: string | null;
  subcategory: string | null;
  color_finish: string | null;
  unit: string | null;
  images: string;
  prices: string;
  tags: string;
  custom_fields: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToProduct(row: SkuRowFromDb): Product {
  return {
    id: row.id ?? '', // v4 backfill guarantees non-null in practice
    brandId: row.brand_id,
    sku: row.sku,
    barcode: row.barcode,
    secondaryCode: row.secondary_code,
    // Spec uses `name`; legacy column is `product_name`. Surface as `name`
    // so the new UI matches the spec contract.
    name: row.product_name,
    category: row.category,
    subcategory: row.subcategory,
    colorFinish: row.color_finish,
    description: row.description,
    unit: row.unit,
    images: parseJson<string[]>(row.images, []),
    prices: parseJson<ProductPrices>(row.prices, {}),
    tags: parseJson<string[]>(row.tags, []),
    customFields: parseJson<ProductCustomFields>(row.custom_fields, {}),
    status: (row.status as ProductStatus) ?? 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

// Columns selected for any read that returns a Product. Keeping the list in
// one place avoids drift when we add columns later.
const PRODUCT_COLUMNS = `
  id, sku, brand_id, product_name, barcode, description,
  secondary_code, category, subcategory, color_finish, unit,
  images, prices, tags, custom_fields, status,
  created_at, updated_at
`;

// ── Public API ──────────────────────────────────────────────────────────────

export const ProductService = {
  list(filters: ProductFilters = {}): Product[] {
    const db = getDb();
    const where: string[] = [];
    const params: Array<string> = [];

    if (filters.brandId !== undefined && filters.brandId !== null) {
      where.push('brand_id = ?');
      params.push(filters.brandId);
    }
    if (filters.category) {
      where.push('category = ?');
      params.push(filters.category);
    }
    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }
    if (filters.search) {
      // Matches spec §7: search across sku, name, color_finish, tags,
      // barcode, secondary_code. `tags` is a JSON string — LIKE will hit
      // it. Not perfect (matches `tag` keys too) but adequate; can move
      // to FTS5 later if needed.
      where.push(
        '(sku LIKE ? OR product_name LIKE ? OR color_finish LIKE ? OR tags LIKE ? OR barcode LIKE ? OR secondary_code LIKE ?)',
      );
      const term = `%${filters.search}%`;
      params.push(term, term, term, term, term, term);
    }

    const sql = `SELECT ${PRODUCT_COLUMNS} FROM skus
                 ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY category, product_name, sku`;
    const rows = db.prepare(sql).all(...params) as SkuRowFromDb[];
    return rows.map(rowToProduct);
  },

  get(id: string): Product | null {
    const db = getDb();
    const row = db
      .prepare(`SELECT ${PRODUCT_COLUMNS} FROM skus WHERE id = ?`)
      .get(id) as SkuRowFromDb | undefined;
    return row ? rowToProduct(row) : null;
  },

  getBySku(brandId: string, sku: string): Product | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT ${PRODUCT_COLUMNS} FROM skus WHERE brand_id = ? AND sku = ?`,
      )
      .get(brandId, sku) as SkuRowFromDb | undefined;
    return row ? rowToProduct(row) : null;
  },

  /** Insert a new product. SKU must be non-empty; throws if (brand_id, sku)
   *  already exists. Returns the created product. */
  create(input: ProductInput): Product {
    const db = getDb();
    const sku = input.sku?.trim();
    if (!sku) throw new Error('SKU is required');
    if (!input.brandId) throw new Error('Brand ID is required');

    const existing = ProductService.getBySku(input.brandId, sku);
    if (existing) {
      throw new Error(`Product ${sku} already exists for this brand`);
    }

    const ts = nowIso();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO skus (
         id, sku, brand_id, product_name, barcode, description,
         secondary_code, category, subcategory, color_finish, unit,
         images, prices, tags, custom_fields, status,
         created_at, updated_at
       ) VALUES (
         @id, @sku, @brand_id, @product_name, @barcode, @description,
         @secondary_code, @category, @subcategory, @color_finish, @unit,
         @images, @prices, @tags, @custom_fields, @status,
         @created_at, @updated_at
       )`,
    ).run({
      id,
      sku,
      brand_id: input.brandId,
      product_name: input.name ?? null,
      barcode: input.barcode ?? null,
      description: input.description ?? null,
      secondary_code: input.secondaryCode ?? null,
      category: input.category ?? null,
      subcategory: input.subcategory ?? null,
      color_finish: input.colorFinish ?? null,
      unit: input.unit ?? null,
      images: JSON.stringify(input.images ?? []),
      prices: JSON.stringify(input.prices ?? {}),
      tags: JSON.stringify(input.tags ?? []),
      custom_fields: JSON.stringify(input.customFields ?? {}),
      status: input.status ?? 'active',
      created_at: ts,
      updated_at: ts,
    });

    return ProductService.get(id)!;
  },

  /** Partial update — fields not in the patch keep their current value.
   *  Returns the updated product, or null if `id` doesn't exist. */
  update(id: string, patch: Partial<ProductInput>): Product | null {
    const db = getDb();
    const current = ProductService.get(id);
    if (!current) return null;

    // For non-empty `images`, enforce the cap. Empty array means "clear" and
    // is allowed.
    if (patch.images && patch.images.length > MAX_IMAGES_PER_PRODUCT) {
      throw new Error(
        `Image limit: a product can have at most ${MAX_IMAGES_PER_PRODUCT} images.`,
      );
    }

    db.prepare(
      `UPDATE skus SET
         sku = @sku,
         brand_id = @brand_id,
         product_name = @product_name,
         barcode = @barcode,
         description = @description,
         secondary_code = @secondary_code,
         category = @category,
         subcategory = @subcategory,
         color_finish = @color_finish,
         unit = @unit,
         images = @images,
         prices = @prices,
         tags = @tags,
         custom_fields = @custom_fields,
         status = @status,
         updated_at = @updated_at
       WHERE id = @id`,
    ).run({
      id,
      sku: (patch.sku ?? current.sku).trim(),
      brand_id: patch.brandId ?? current.brandId,
      product_name: patch.name !== undefined ? patch.name : current.name,
      barcode: patch.barcode !== undefined ? patch.barcode : current.barcode,
      description:
        patch.description !== undefined ? patch.description : current.description,
      secondary_code:
        patch.secondaryCode !== undefined
          ? patch.secondaryCode
          : current.secondaryCode,
      category: patch.category !== undefined ? patch.category : current.category,
      subcategory:
        patch.subcategory !== undefined ? patch.subcategory : current.subcategory,
      color_finish:
        patch.colorFinish !== undefined ? patch.colorFinish : current.colorFinish,
      unit: patch.unit !== undefined ? patch.unit : current.unit,
      images: JSON.stringify(patch.images ?? current.images),
      prices: JSON.stringify(patch.prices ?? current.prices),
      tags: JSON.stringify(patch.tags ?? current.tags),
      custom_fields: JSON.stringify(patch.customFields ?? current.customFields),
      status: patch.status ?? current.status,
      updated_at: nowIso(),
    });

    return ProductService.get(id);
  },

  /** Hard-delete. No tombstones for products (spec §22). */
  remove(id: string): boolean {
    const db = getDb();
    const r = db.prepare('DELETE FROM skus WHERE id = ?').run(id);
    return r.changes > 0;
  },

  /** Distinct, non-empty categories. Scoped to a brand when provided,
   *  otherwise across the whole library. Used by the sidebar filter. */
  categories(brandId?: string): string[] {
    const db = getDb();
    const sql = brandId
      ? `SELECT DISTINCT category FROM skus
         WHERE brand_id = ? AND category IS NOT NULL AND category != ''
         ORDER BY category COLLATE NOCASE`
      : `SELECT DISTINCT category FROM skus
         WHERE category IS NOT NULL AND category != ''
         ORDER BY category COLLATE NOCASE`;
    const rows = (brandId
      ? db.prepare(sql).all(brandId)
      : db.prepare(sql).all()) as Array<{ category: string }>;
    return rows.map((r) => r.category);
  },

  /** Partial-update upsert for bulk imports. Spec §7 invariant: every field
   *  falls back to the existing value when the import row doesn't supply
   *  one. Empty / undefined values in `rows` are treated as "didn't touch
   *  this column". Prices and customFields are merged, not replaced. Tags
   *  replace only when a non-empty array is supplied. */
  bulkUpsert(rows: ProductInput[]): { inserted: number; updated: number } {
    const db = getDb();
    let inserted = 0;
    let updated = 0;

    const tx = db.transaction((items: ProductInput[]) => {
      for (const row of items) {
        const sku = row.sku?.trim();
        if (!sku || !row.brandId) continue;

        const existing = ProductService.getBySku(row.brandId, sku);
        const ts = nowIso();

        // Merge JSON object fields
        const mergedPrices = { ...(existing?.prices ?? {}), ...(row.prices ?? {}) };
        const mergedCustom = {
          ...(existing?.customFields ?? {}),
          ...(row.customFields ?? {}),
        };
        // Tags: replace if supplied (non-empty), preserve otherwise
        const nextTags =
          row.tags && row.tags.length > 0 ? row.tags : existing?.tags ?? [];

        const id = existing?.id ?? randomUUID();
        db.prepare(
          `INSERT INTO skus (
             id, sku, brand_id, product_name, barcode, description,
             secondary_code, category, subcategory, color_finish, unit,
             images, prices, tags, custom_fields, status,
             created_at, updated_at
           ) VALUES (
             @id, @sku, @brand_id, @product_name, @barcode, @description,
             @secondary_code, @category, @subcategory, @color_finish, @unit,
             @images, @prices, @tags, @custom_fields, @status,
             @created_at, @updated_at
           )
           ON CONFLICT(sku, brand_id) DO UPDATE SET
             product_name   = excluded.product_name,
             barcode        = excluded.barcode,
             description    = excluded.description,
             secondary_code = excluded.secondary_code,
             category       = excluded.category,
             subcategory    = excluded.subcategory,
             color_finish   = excluded.color_finish,
             unit           = excluded.unit,
             prices         = excluded.prices,
             tags           = excluded.tags,
             custom_fields  = excluded.custom_fields,
             status         = excluded.status,
             updated_at     = excluded.updated_at`,
        ).run({
          id,
          sku,
          brand_id: row.brandId,
          // Partial-update merge: undefined in the import row → keep existing
          product_name: row.name ?? existing?.name ?? null,
          barcode: row.barcode ?? existing?.barcode ?? null,
          description: row.description ?? existing?.description ?? null,
          secondary_code: row.secondaryCode ?? existing?.secondaryCode ?? null,
          category: row.category ?? existing?.category ?? null,
          subcategory: row.subcategory ?? existing?.subcategory ?? null,
          color_finish: row.colorFinish ?? existing?.colorFinish ?? null,
          unit: row.unit ?? existing?.unit ?? null,
          // Images and variants are never touched by import (spec §20 #5).
          images: JSON.stringify(existing?.images ?? []),
          prices: JSON.stringify(mergedPrices),
          tags: JSON.stringify(nextTags),
          custom_fields: JSON.stringify(mergedCustom),
          status: row.status ?? existing?.status ?? 'active',
          created_at: existing?.createdAt ?? ts,
          updated_at: ts,
        });

        if (existing) updated++;
        else inserted++;
      }
    });
    tx(rows);

    return { inserted, updated };
  },

  /** Image array operations. All four validate ownership (id exists),
   *  enforce MAX_IMAGES_PER_PRODUCT, and dedupe. */

  addImageToProduct(id: string, relativePath: string): Product | null {
    const current = ProductService.get(id);
    if (!current) return null;
    if (current.images.includes(relativePath)) return current; // dedup no-op
    if (current.images.length >= MAX_IMAGES_PER_PRODUCT) {
      throw new Error(
        `This product already has the maximum of ${MAX_IMAGES_PER_PRODUCT} images.`,
      );
    }
    return ProductService.update(id, { images: [...current.images, relativePath] });
  },

  removeImageFromProduct(id: string, relativePath: string): Product | null {
    const current = ProductService.get(id);
    if (!current) return null;
    const next = current.images.filter((p) => p !== relativePath);
    if (next.length === current.images.length) return current;
    return ProductService.update(id, { images: next });
  },

  setMainImage(id: string, relativePath: string): Product | null {
    const current = ProductService.get(id);
    if (!current) return null;
    if (!current.images.includes(relativePath)) return current;
    const next = [
      relativePath,
      ...current.images.filter((p) => p !== relativePath),
    ];
    return ProductService.update(id, { images: next });
  },

  /** Reorder validates `newOrder` is a permutation of the existing images —
   *  same length, same set. Spec §20 invariant #8. */
  reorderImages(id: string, newOrder: string[]): Product | null {
    const current = ProductService.get(id);
    if (!current) return null;
    if (newOrder.length !== current.images.length) {
      throw new Error('Reorder: new order length must match current image count.');
    }
    const sortedA = [...current.images].sort();
    const sortedB = [...newOrder].sort();
    for (let i = 0; i < sortedA.length; i++) {
      if (sortedA[i] !== sortedB[i]) {
        throw new Error('Reorder: new order must be a permutation of existing images.');
      }
    }
    return ProductService.update(id, { images: newOrder });
  },
};
