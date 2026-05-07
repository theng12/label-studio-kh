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
  defaultFont: string;
  website: string;
  address: string;
  phone: string;
  email: string;
  certBadges: string[]; // paths
  tagline: string;
  establishedYear: string;
  category?: string;
  customerCareLabel?: string;
  hidden?: boolean; // demo brand can be hidden but not deleted
  isDemo?: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type NewBrandInput = Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>;
