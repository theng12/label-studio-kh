// Product types — the Product Library data model.
//
// Mirrors the spec at docs/PRODUCT_LIBRARY_HANDOFF.md §5–6, adapted to our
// schema: parent FK is `brandId` (not `companyId` — Label Studio KH has no
// Company concept), and these fields live on the existing `skus` table
// alongside the legacy columns the importer and Generate page still use.

export type ProductStatus = 'active' | 'inactive' | 'draft';

/** Prices keyed by group name. v1 hardcodes "Retail" and "Wholesale". */
export type ProductPrices = Record<string, number | string>;

/** User-defined extra columns from import. Spec §22 defers the management UI;
 *  we accept arbitrary string keys/values today so import round-trips them. */
export type ProductCustomFields = Record<string, string>;

export interface Product {
  /** UUID assigned at create time. Stable identifier used across IPC. */
  id: string;
  /** Parent FK. Required — every product belongs to exactly one brand. */
  brandId: string;
  /** Natural key within a brand. Required, trimmed, case-sensitive. */
  sku: string;

  // Identifiers
  barcode: string | null;
  secondaryCode: string | null;

  // Classification
  name: string | null;
  category: string | null;
  subcategory: string | null;
  colorFinish: string | null;
  description: string | null;
  unit: string | null;

  // Multi-image: ordered list of asset-relative paths.
  // Position 0 = main. Cap is enforced in main-process IPC, not the type.
  images: string[];

  // Pricing (dynamic keys — see ProductPrices)
  prices: ProductPrices;

  // Free-form classification + import-preserved extras
  tags: string[];
  customFields: ProductCustomFields;

  status: ProductStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** Input shape for create/update. All non-key fields are optional so partial
 *  updates work cleanly. brandId + sku required on create; on update the
 *  service identifies the row by id (passed separately). */
export interface ProductInput {
  brandId: string;
  sku: string;
  barcode?: string | null;
  secondaryCode?: string | null;
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  colorFinish?: string | null;
  description?: string | null;
  unit?: string | null;
  images?: string[];
  prices?: ProductPrices;
  tags?: string[];
  customFields?: ProductCustomFields;
  status?: ProductStatus;
}

/** List filters applied in ProductService.list. All optional. */
export interface ProductFilters {
  search?: string; // matches sku, name, color_finish, tags, barcode, secondary_code
  /** Scope to a single Company. The Product Library page sets this to the
   *  active companyId so cross-company products never leak in. */
  companyId?: string;
  brandId?: string | null; // string = exact brand. null/undefined = no brand filter.
  category?: string | null; // null/undefined = no category filter.
  status?: ProductStatus;
}

/** Hard cap per spec §1 item 11 and invariant #6. Enforced in IPC, not types. */
export const MAX_IMAGES_PER_PRODUCT = 20;

/** v1 default price groups. Single-tenant app; making these configurable can
 *  come later via Settings. The spec contemplates per-Company groups, but
 *  Label Studio KH has no Company layer above brands. */
export const DEFAULT_PRICE_GROUPS = ['Retail', 'Wholesale'] as const;
