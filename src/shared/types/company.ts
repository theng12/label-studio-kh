// Company type — the top-level parent entity above Brand.
//
// One company holds many brands; each brand holds many products. A single
// install can manage multiple companies (e.g. a designer running labels for
// two unrelated businesses). The "active company" is what most pages scope
// to — Brand picker, Product Library, Templates, etc. Stored in
// settings.json as `activeCompanyId`.

/** Per-company price tier names — e.g. ["Retail", "Wholesale", "VIP"].
 *  ProductForm renders one numeric input per entry. Default seeded on
 *  first run is ["Retail", "Wholesale"]. */
export type PriceGroups = string[];

/** Reserved for future ProductForm + Import wiring (spec §22 defers
 *  the management UI). Each entry is the column name we'll expose. */
export interface CustomField {
  name: string;
}

export interface Company {
  /** UUID assigned at create time. Stable identifier referenced from
   *  Brand.companyId and skus.company_id. */
  id: string;
  name: string;
  /** Swatch color for the workspace switcher chip. */
  color: string;
  /** Relative path under assets/companies/<file>, or null. */
  logoPath: string | null;
  address: string;
  phone: string;
  email: string;
  website: string;
  priceGroups: PriceGroups;
  customFields: CustomField[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** Input shape for create. id + timestamps are filled by the service. */
export interface CompanyInput {
  name: string;
  color?: string;
  logoPath?: string | null;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  priceGroups?: PriceGroups;
  customFields?: CustomField[];
}

/** Default price tiers used when bootstrapping the first company on a
 *  fresh install or upgrade. Aligned with the user's external inventory/
 *  POS system so CSV columns ("Cost Price", "Selling Price", "Wholesale
 *  Price", "Min Selling Price") map directly into product.prices by
 *  group name. Users can edit these per-company on the /company page. */
export const DEFAULT_PRICE_GROUPS: PriceGroups = [
  'Cost',
  'Selling',
  'Wholesale',
  'Min Selling',
];

/** Cap on custom fields per spec §2. Enforced in the UI in a later
 *  phase; today the array isn't size-checked at runtime. */
export const MAX_CUSTOM_FIELDS = 10;
