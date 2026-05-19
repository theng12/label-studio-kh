import { create } from 'zustand';
import type {
  Product,
  ProductFilters,
  ProductInput,
} from '../../shared/types/product';
import { toast } from '../components/Toast';

// Mirrors the spec's Zustand store at
// docs/PRODUCT_LIBRARY_HANDOFF.md §15, adapted to our app:
//   - No `activeCompanyId` (we have no Company entity). Brand selection
//     lives in the existing brandStore + useDefaultBrand hook.
//   - Filter state lives here; the Products page reads `filters` to call
//     the IPC, and `categoriesAll` is fetched independently of filters so
//     the sidebar list stays stable when the user filters down.

interface ProductState {
  products: Product[];
  /** Stable list of category names — independent of current filters so the
   *  sidebar doesn't shrink when the user selects one. */
  categoriesAll: string[];
  filters: ProductFilters;
  loading: boolean;

  // Filter setters — they update filters AND refresh the list.
  setSearch: (search: string) => Promise<void>;
  setCategory: (category: string | null) => Promise<void>;
  setBrand: (brandId: string | null | undefined) => Promise<void>;
  setStatus: (status: ProductFilters['status']) => Promise<void>;

  refreshProducts: () => Promise<void>;
  refreshCategories: () => Promise<void>;

  createProduct: (input: ProductInput) => Promise<Product>;
  updateProduct: (
    id: string,
    patch: Partial<ProductInput>,
  ) => Promise<Product | null>;
  removeProduct: (id: string) => Promise<boolean>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  categoriesAll: [],
  filters: {},
  loading: false,

  setSearch: async (search) => {
    set({ filters: { ...get().filters, search: search || undefined } });
    await get().refreshProducts();
  },
  setCategory: async (category) => {
    set({ filters: { ...get().filters, category } });
    await get().refreshProducts();
  },
  setBrand: async (brandId) => {
    set({ filters: { ...get().filters, brandId } });
    // Categories are brand-scoped: switching brand refreshes the sidebar list.
    await Promise.all([get().refreshProducts(), get().refreshCategories()]);
  },
  setStatus: async (status) => {
    set({ filters: { ...get().filters, status } });
    await get().refreshProducts();
  },

  refreshProducts: async () => {
    set({ loading: true });
    try {
      const products = await window.api.products.list(get().filters);
      set({ products, loading: false });
    } catch (err) {
      set({ loading: false });
      toast.error(`Couldn't load products: ${String(err)}`);
    }
  },

  refreshCategories: async () => {
    try {
      const brandId =
        typeof get().filters.brandId === 'string'
          ? (get().filters.brandId as string)
          : undefined;
      const cats = await window.api.products.categories(brandId);
      set({ categoriesAll: cats });
    } catch (err) {
      // Quietly ignore — the sidebar just shows no categories.
      console.error('refreshCategories failed:', err);
    }
  },

  createProduct: async (input) => {
    const created = await window.api.products.create(input);
    set({ products: [...get().products, created] });
    void get().refreshCategories();
    toast.success(`Product "${created.sku}" created.`);
    return created;
  },

  updateProduct: async (id, patch) => {
    try {
      const updated = await window.api.products.update(id, patch);
      if (updated) {
        set({
          products: get().products.map((p) => (p.id === id ? updated : p)),
        });
        void get().refreshCategories();
      }
      return updated;
    } catch (err) {
      toast.error(`Couldn't update product: ${String(err)}`);
      throw err;
    }
  },

  removeProduct: async (id) => {
    try {
      const ok = await window.api.products.remove(id);
      if (ok) {
        set({ products: get().products.filter((p) => p.id !== id) });
        void get().refreshCategories();
        toast.info('Product deleted.');
      }
      return ok;
    } catch (err) {
      toast.error(`Couldn't delete product: ${String(err)}`);
      throw err;
    }
  },
}));
