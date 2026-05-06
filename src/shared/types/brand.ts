export interface Brand {
  id: string;
  name: string;
  color: string; // hex
  logoPath: string | null;
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
