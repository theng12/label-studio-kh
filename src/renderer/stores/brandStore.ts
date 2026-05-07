import { create } from 'zustand';
import type { Brand, NewBrandInput } from '../../shared/types/brand';
import { toast } from '../components/Toast';

interface BrandState {
  brands: Brand[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: NewBrandInput) => Promise<Brand>;
  update: (id: string, patch: Partial<NewBrandInput>) => Promise<Brand | null>;
  remove: (id: string) => Promise<boolean>;
}

export const useBrandStore = create<BrandState>((set, get) => ({
  brands: [],
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const brands = await window.api.brand.list();
      set({ brands, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
      toast.error(`Couldn't load brands: ${String(err)}`);
    }
  },

  create: async (input) => {
    try {
      const brand = await window.api.brand.create(input);
      set({ brands: [...get().brands, brand] });
      toast.success(`Brand "${brand.name}" created.`);
      return brand;
    } catch (err) {
      toast.error(`Couldn't create brand: ${String(err)}`);
      throw err;
    }
  },

  update: async (id, patch) => {
    try {
      const updated = await window.api.brand.update(id, patch);
      if (updated) {
        set({ brands: get().brands.map((b) => (b.id === id ? updated : b)) });
      }
      return updated;
    } catch (err) {
      toast.error(`Couldn't save brand: ${String(err)}`);
      throw err;
    }
  },

  remove: async (id) => {
    try {
      const ok = await window.api.brand.delete(id);
      if (ok) set({ brands: get().brands.filter((b) => b.id !== id) });
      return ok;
    } catch (err) {
      toast.error(`Couldn't delete brand: ${String(err)}`);
      throw err;
    }
  },
}));
