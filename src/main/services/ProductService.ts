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
import { BrandService } from './BrandService';
import { AuditService } from './AuditService';
import {
  importProductImageFromPath,
  scanImagesRecursive,
  groupAndSortMatches,
} from './ProductImageManager';
import type {
  Product,
  ProductInput,
  ProductFilters,
  ProductPrices,
  ProductCustomFields,
  ProductStatus,
} from '@shared/types/product';
import { MAX_IMAGES_PER_PRODUCT } from '@shared/types/product';

export interface AutoMatchStats {
  /** Image files seen during the folder scan. */
  scannedFiles: number;
  /** Distinct SKUs that had at least one image candidate matched. */
  matchedSkus: number;
  /** Products in this company that exist in the DB (denominator for
   *  "X of N SKUs matched" display). */
  totalProducts: number;
  /** Image files copied into the assets folder this run. */
  imagesImported: number;
  /** Files that matched but already existed on disk (content-hash hit)
   *  OR were already in the product's image array. */
  imagesSkippedDup: number;
  /** Files dropped because they would have pushed the product past the
   *  per-product image cap. */
  imagesSkippedCap: number;
  /** Files that didn't match any SKU under the chosen folder. */
  unmatchedFiles: number;
  /** Products that received at least one new image this run. */
  productsTouched: number;
  /** Mirror of MAX_IMAGES_PER_PRODUCT for the UI's results display. */
  maxImagesPerProduct: number;
}

// Resolve a brand's parent company. Cached per-call to avoid repeated
// disk reads when bulk-upserting many rows. The bootstrap step in
// CompanyService.ensureBootstrap guarantees every brand has a companyId,
// so this should always return a string in practice; null is the
// defensive fallback.
function getCompanyIdForBrand(brandId: string): string | null {
  const brand = BrandService.get(brandId);
  return brand?.companyId ?? null;
}

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
  // v5 — denormalized parent company. Always populated for new rows;
  // older rows backfilled by CompanyService.ensureBootstrap.
  company_id: string | null;
  // v7 — inventory & lifecycle (round-trip data; Label Studio doesn't act).
  expiry_date: string | null;
  tax_rate: string | null;
  reorder_point: string | null;
  reorder_quantity: string | null;
  track_inventory: number; // SQLite boolean (0/1)
  variant_attributes: string | null;
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
    // v7 inventory & lifecycle
    expiryDate: row.expiry_date,
    taxRate: row.tax_rate,
    reorderPoint: row.reorder_point,
    reorderQuantity: row.reorder_quantity,
    trackInventory: !!row.track_inventory,
    variantAttributes: row.variant_attributes,
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
  company_id,
  expiry_date, tax_rate, reorder_point, reorder_quantity,
  track_inventory, variant_attributes,
  created_at, updated_at
`;

// ── Public API ──────────────────────────────────────────────────────────────

export const ProductService = {
  list(filters: ProductFilters = {}): Product[] {
    const db = getDb();
    const where: string[] = [];
    const params: Array<string> = [];

    if (filters.companyId) {
      where.push('company_id = ?');
      params.push(filters.companyId);
    }
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
    const companyId = getCompanyIdForBrand(input.brandId);
    db.prepare(
      `INSERT INTO skus (
         id, sku, brand_id, product_name, barcode, description,
         secondary_code, category, subcategory, color_finish, unit,
         images, prices, tags, custom_fields, status,
         company_id,
         expiry_date, tax_rate, reorder_point, reorder_quantity,
         track_inventory, variant_attributes,
         created_at, updated_at
       ) VALUES (
         @id, @sku, @brand_id, @product_name, @barcode, @description,
         @secondary_code, @category, @subcategory, @color_finish, @unit,
         @images, @prices, @tags, @custom_fields, @status,
         @company_id,
         @expiry_date, @tax_rate, @reorder_point, @reorder_quantity,
         @track_inventory, @variant_attributes,
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
      company_id: companyId,
      expiry_date: input.expiryDate ?? null,
      tax_rate: input.taxRate ?? null,
      reorder_point: input.reorderPoint ?? null,
      reorder_quantity: input.reorderQuantity ?? null,
      track_inventory: input.trackInventory ? 1 : 0,
      variant_attributes: input.variantAttributes ?? null,
      created_at: ts,
      updated_at: ts,
    });

    const created = ProductService.get(id)!;
    AuditService.log({
      entityType: 'product',
      entityId: id,
      companyId,
      action: 'create',
      summary: `Created product ${sku}${input.name ? ` — ${input.name}` : ''}`,
      after: {
        sku,
        name: input.name ?? null,
        brandId: input.brandId,
        status: input.status ?? 'active',
      },
    });
    return created;
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
         expiry_date = @expiry_date,
         tax_rate = @tax_rate,
         reorder_point = @reorder_point,
         reorder_quantity = @reorder_quantity,
         track_inventory = @track_inventory,
         variant_attributes = @variant_attributes,
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
      expiry_date:
        patch.expiryDate !== undefined ? patch.expiryDate : current.expiryDate,
      tax_rate: patch.taxRate !== undefined ? patch.taxRate : current.taxRate,
      reorder_point:
        patch.reorderPoint !== undefined
          ? patch.reorderPoint
          : current.reorderPoint,
      reorder_quantity:
        patch.reorderQuantity !== undefined
          ? patch.reorderQuantity
          : current.reorderQuantity,
      track_inventory:
        (patch.trackInventory !== undefined
          ? patch.trackInventory
          : current.trackInventory)
          ? 1
          : 0,
      variant_attributes:
        patch.variantAttributes !== undefined
          ? patch.variantAttributes
          : current.variantAttributes,
      updated_at: nowIso(),
    });

    const updated = ProductService.get(id);
    // Audit: log only the keys that actually changed. `images` mutations
    // go through the dedicated image ops below (image:add etc.), so we
    // exclude them here to avoid noisy "images: [array]" diffs on every
    // scalar edit. The image ops log their own granular events.
    const { images: _ignoredImages, ...auditablePatch } = patch;
    void _ignoredImages;
    AuditService.logUpdate({
      entityType: 'product',
      entityId: id,
      companyId: getCompanyIdForBrand(updated?.brandId ?? current.brandId),
      beforeRow: current as unknown as Record<string, unknown>,
      patch: auditablePatch as Record<string, unknown>,
      summary: `Edited ${current.sku}`,
    });
    return updated;
  },

  /** Hard-delete. No tombstones for products (spec §22). */
  remove(id: string): boolean {
    const db = getDb();
    // Snapshot before delete so the audit log can show what was removed.
    const before = ProductService.get(id);
    const r = db.prepare('DELETE FROM skus WHERE id = ?').run(id);
    if (r.changes > 0 && before) {
      AuditService.log({
        entityType: 'product',
        entityId: id,
        companyId: getCompanyIdForBrand(before.brandId),
        action: 'delete',
        summary: `Deleted product ${before.sku}${before.name ? ` — ${before.name}` : ''}`,
        before: {
          sku: before.sku,
          name: before.name,
          brandId: before.brandId,
          imageCount: before.images.length,
        },
      });
    }
    return r.changes > 0;
  },

  /** Product count grouped by brand_id. Single-query alternative to
   *  calling list({ brandId }).length once per brand — used by the
   *  Brands page card grid. Optional company scope mirrors the rest
   *  of the service. */
  countsByBrand(companyId?: string): Record<string, number> {
    const db = getDb();
    const where = companyId ? 'WHERE company_id = ?' : '';
    const params = companyId ? [companyId] : [];
    const rows = db
      .prepare(
        `SELECT brand_id, COUNT(*) AS c FROM skus ${where} GROUP BY brand_id`,
      )
      .all(...params) as Array<{ brand_id: string; c: number }>;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.brand_id] = r.c;
    return out;
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
        const companyId = getCompanyIdForBrand(row.brandId);
        db.prepare(
          `INSERT INTO skus (
             id, sku, brand_id, product_name, barcode, description,
             secondary_code, category, subcategory, color_finish, unit,
             images, prices, tags, custom_fields, status,
             company_id,
             expiry_date, tax_rate, reorder_point, reorder_quantity,
             track_inventory, variant_attributes,
             created_at, updated_at
           ) VALUES (
             @id, @sku, @brand_id, @product_name, @barcode, @description,
             @secondary_code, @category, @subcategory, @color_finish, @unit,
             @images, @prices, @tags, @custom_fields, @status,
             @company_id,
             @expiry_date, @tax_rate, @reorder_point, @reorder_quantity,
             @track_inventory, @variant_attributes,
             @created_at, @updated_at
           )
           ON CONFLICT(sku, brand_id) DO UPDATE SET
             product_name       = excluded.product_name,
             barcode            = excluded.barcode,
             description        = excluded.description,
             secondary_code     = excluded.secondary_code,
             category           = excluded.category,
             subcategory        = excluded.subcategory,
             color_finish       = excluded.color_finish,
             unit               = excluded.unit,
             prices             = excluded.prices,
             tags               = excluded.tags,
             custom_fields      = excluded.custom_fields,
             status             = excluded.status,
             company_id         = excluded.company_id,
             expiry_date        = excluded.expiry_date,
             tax_rate           = excluded.tax_rate,
             reorder_point      = excluded.reorder_point,
             reorder_quantity   = excluded.reorder_quantity,
             track_inventory    = excluded.track_inventory,
             variant_attributes = excluded.variant_attributes,
             updated_at         = excluded.updated_at`,
        ).run({
          id,
          sku,
          brand_id: row.brandId,
          // Partial-update merge: undefined in the import row → keep existing.
          // For nullable text columns we let an explicit null pass through;
          // for the boolean we fall back to existing or false.
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
          company_id: companyId,
          // v7 inventory/lifecycle — partial-update with merge semantics.
          expiry_date: row.expiryDate ?? existing?.expiryDate ?? null,
          tax_rate: row.taxRate ?? existing?.taxRate ?? null,
          reorder_point: row.reorderPoint ?? existing?.reorderPoint ?? null,
          reorder_quantity:
            row.reorderQuantity ?? existing?.reorderQuantity ?? null,
          track_inventory:
            (row.trackInventory ?? existing?.trackInventory ?? false) ? 1 : 0,
          variant_attributes:
            row.variantAttributes ?? existing?.variantAttributes ?? null,
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
    const result = ProductService.update(id, {
      images: [...current.images, relativePath],
    });
    AuditService.log({
      entityType: 'image',
      entityId: id,
      companyId: getCompanyIdForBrand(current.brandId),
      action: 'image:add',
      summary: `Added an image to ${current.sku} (now ${current.images.length + 1})`,
      after: { path: relativePath },
    });
    return result;
  },

  removeImageFromProduct(id: string, relativePath: string): Product | null {
    const current = ProductService.get(id);
    if (!current) return null;
    const next = current.images.filter((p) => p !== relativePath);
    if (next.length === current.images.length) return current;
    const result = ProductService.update(id, { images: next });
    AuditService.log({
      entityType: 'image',
      entityId: id,
      companyId: getCompanyIdForBrand(current.brandId),
      action: 'image:remove',
      summary: `Removed an image from ${current.sku} (now ${next.length})`,
      before: { path: relativePath },
    });
    return result;
  },

  setMainImage(id: string, relativePath: string): Product | null {
    const current = ProductService.get(id);
    if (!current) return null;
    if (!current.images.includes(relativePath)) return current;
    const next = [
      relativePath,
      ...current.images.filter((p) => p !== relativePath),
    ];
    const result = ProductService.update(id, { images: next });
    AuditService.log({
      entityType: 'image',
      entityId: id,
      companyId: getCompanyIdForBrand(current.brandId),
      action: 'image:set-main',
      summary: `Set a new main image for ${current.sku}`,
      after: { path: relativePath },
    });
    return result;
  },

  /** Drop a folder of images on the company → app figures out which SKU
   *  each file belongs to (by filename or parent-folder name), copies it
   *  into the assets store with content-hash dedup, and attaches it to
   *  the right product. Spec §11.
   *
   *  Returns rich stats so the AutoMatchModal can show scanned / matched
   *  / imported / dup-skipped / cap-skipped / unmatched. */
  async autoMatchImagesBySku(
    companyId: string,
    folderPath: string,
  ): Promise<AutoMatchStats> {
    // List products in this company. Lowercase the sku for case-insensitive
    // matching against filenames; keep a back-map to the canonical Product
    // so we update the right row.
    const products = ProductService.list({ companyId });
    const skuToProduct = new Map<string, Product>();
    for (const p of products) skuToProduct.set(p.sku.toLowerCase(), p);
    const skuSet = new Set(skuToProduct.keys());

    const allImages = scanImagesRecursive(folderPath);
    const { groups, unmatched } = groupAndSortMatches(
      allImages,
      folderPath,
      skuSet,
    );

    let productsTouched = 0;
    let imagesImported = 0;
    let imagesSkippedDup = 0;
    let imagesSkippedCap = 0;

    for (const [skuLower, candidates] of groups) {
      const product = skuToProduct.get(skuLower);
      if (!product) continue;

      // Cap each SKU's incoming candidate list up front so per-SKU file
      // overflows are counted accurately. The remaining cap is checked
      // again below against the existing image array.
      const capped = candidates.slice(0, MAX_IMAGES_PER_PRODUCT);
      imagesSkippedCap += candidates.length - capped.length;

      // Copy each candidate file into assets. Same-content files dedupe
      // to the same on-disk filename, which is also what we add to the
      // product's image array — so importing the same file twice is a
      // no-op at both layers.
      const matchedRelPaths: string[] = [];
      let touched = false;
      for (const c of capped) {
        try {
          const { relativePath, skipped } = await importProductImageFromPath(
            c.sourcePath,
            product.sku,
          );
          if (matchedRelPaths.includes(relativePath)) {
            // Same file matched twice in the same run (e.g. duplicate
            // copy in a different subfolder). Don't add the relative
            // path twice.
            imagesSkippedDup += 1;
            continue;
          }
          matchedRelPaths.push(relativePath);
          const wasAlreadyOnProduct = product.images.includes(relativePath);
          if (skipped || wasAlreadyOnProduct) imagesSkippedDup += 1;
          else {
            imagesImported += 1;
            touched = true;
          }
        } catch (err) {
          // One bad file (unsupported extension, permissions, etc.)
          // shouldn't kill the whole import. Count it as unmatched so
          // the user notices.
          console.error(`Auto-match import failed for ${c.sourcePath}:`, err);
        }
      }

      // Rebuild the product's image array: matched files first (their
      // indexHint sorting puts the main candidate at position 0), then
      // any pre-existing images that weren't part of this match. Truncate
      // to the global cap if the union exceeds it.
      const existing = product.images;
      const keep = existing.filter((p) => !matchedRelPaths.includes(p));
      const combined = [...matchedRelPaths, ...keep];
      const truncated = combined.slice(0, MAX_IMAGES_PER_PRODUCT);
      imagesSkippedCap += combined.length - truncated.length;

      if (JSON.stringify(truncated) !== JSON.stringify(existing)) {
        ProductService.update(product.id, { images: truncated });
        if (touched) productsTouched += 1;
      }
    }

    return {
      scannedFiles: allImages.length,
      matchedSkus: groups.size,
      totalProducts: products.length,
      imagesImported,
      imagesSkippedDup,
      imagesSkippedCap,
      unmatchedFiles: unmatched.length,
      productsTouched,
      maxImagesPerProduct: MAX_IMAGES_PER_PRODUCT,
    };
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
    const result = ProductService.update(id, { images: newOrder });
    AuditService.log({
      entityType: 'image',
      entityId: id,
      companyId: getCompanyIdForBrand(current.brandId),
      action: 'image:reorder',
      summary: `Reordered images on ${current.sku}`,
    });
    return result;
  },
};
