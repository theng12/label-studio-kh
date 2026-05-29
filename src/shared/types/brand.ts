/**
 * One logo asset belonging to a brand. A brand may have several (icon mark,
 * wordmark / typography, full lockup, monochrome variant, etc.). The first
 * entry in Brand.logos is treated as the default.
 */
export interface BrandLogo {
  id: string;
  name: string;
  path: string;
}

export interface Brand {
  id: string;
  /**
   * Parent Company. Optional in the type for backward compat with brands
   * written before the Company layer was introduced — bootstrap on app
   * start backfills this onto the active default company, so in practice
   * every Brand has a companyId once the app has run once.
   */
  companyId?: string;
  name: string;
  color: string; // hex
  /**
   * Legacy single-logo path. Kept for backwards compatibility — when reading
   * a brand without `logos`, this is treated as the only logo. New code should
   * read from `logos`.
   */
  logoPath: string | null;
  /**
   * All logo variants for this brand. The first entry is the default.
   * Optional for backwards compat with brands written before 0.3.
   */
  logos?: BrandLogo[];
  /**
   * Deprecated. Fonts are configured per element on the template, not per
   * brand. Kept optional for backwards compat with brands written before
   * the per-element font picker was added.
   */
  defaultFont?: string;
  website: string;
  address: string;
  phone: string;
  email: string;
  certBadges: string[]; // paths
  tagline: string;
  establishedYear: string;
  category?: string;
  customerCareLabel?: string;
  hidden?: boolean;
  /**
   * Soft-delete tombstone. When set, the brand is hidden from `list()` but the
   * record (and on-disk assets) remain so a delete can be undone within the
   * session. Brands with this set are purged on next app start.
   */
  deletedAt?: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type NewBrandInput = Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>;
