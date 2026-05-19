import { create } from 'zustand';
import type { Brand, NewBrandInput } from '../../shared/types/brand';
import { toast } from '../components/Toast';
import { useCompanyStore } from './companyStore';

interface BrandState {
  brands: Brand[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: NewBrandInput) => Promise<Brand>;
  update: (id: string, patch: Partial<NewBrandInput>) => Promise<Brand | null>;
  remove: (id: string) => Promise<boolean>;
  restore: (id: string) => Promise<Brand | null>;
}

export const useBrandStore = create<BrandState>((set, get) => ({
  brands: [],
  loading: false,
  error: null,

  refresh: async () => {
    // Scope the brand list to the active company so brand pickers
    // everywhere (Templates, Generate, Barcodes, File Manager sidebar)
    // only show brands from the workspace the user is in. Pass undefined
    // if no company is set yet — backend returns all brands as a
    // graceful fallback for first-launch / bootstrap.
    const activeCompanyId =
      useCompanyStore.getState().activeCompanyId ?? undefined;
    set({ loading: true, error: null });
    try {
      const brands = await window.api.brand.list(activeCompanyId);
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
    // Snapshot the brand before the destructive call so the toast's Undo
    // closure has a name to show even if the list state has moved on.
    const target = get().brands.find((b) => b.id === id) ?? null;
    try {
      const ok = await window.api.brand.delete(id);
      if (!ok) return false;
      set({ brands: get().brands.filter((b) => b.id !== id) });
      const name = target?.name ?? 'Brand';
      toast.info(`Brand "${name}" deleted.`, {
        action: {
          label: 'Undo',
          onClick: () => {
            void get().restore(id);
          },
        },
      });
      return true;
    } catch (err) {
      toast.error(`Couldn't delete brand: ${String(err)}`);
      throw err;
    }
  },

  restore: async (id) => {
    try {
      const restored = await window.api.brand.restore(id);
      if (restored) {
        const exists = get().brands.some((b) => b.id === restored.id);
        set({
          brands: exists
            ? get().brands.map((b) => (b.id === restored.id ? restored : b))
            : [...get().brands, restored],
        });
        toast.success(`Brand "${restored.name}" restored.`);
      }
      return restored;
    } catch (err) {
      toast.error(`Couldn't restore brand: ${String(err)}`);
      throw err;
    }
  },
}));
