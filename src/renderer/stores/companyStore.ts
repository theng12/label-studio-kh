import { create } from 'zustand';
import { toast } from '../components/Toast';
import type { Company, CompanyInput } from '../../shared/types/company';

// Companies + active-company selection.
//
// activeCompanyId is persisted server-side via settings.json (see
// SettingsService). We mirror it here for fast renderer access and to fire
// cross-store refreshes (brandStore + productStore) when it changes.

interface CompanyState {
  companies: Company[];
  activeCompanyId: string | null;
  loading: boolean;

  refresh: () => Promise<void>;
  setActive: (id: string) => Promise<void>;

  create: (input: CompanyInput) => Promise<Company>;
  update: (
    id: string,
    patch: Partial<CompanyInput>,
  ) => Promise<Company | null>;
  remove: (id: string) => Promise<boolean>;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [],
  activeCompanyId: null,
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const [companies, settings] = await Promise.all([
        window.api.company.list(),
        window.api.settings.get(),
      ]);
      set({
        companies,
        activeCompanyId: settings.activeCompanyId,
        loading: false,
      });
    } catch (err) {
      set({ loading: false });
      toast.error(`Couldn't load companies: ${String(err)}`);
    }
  },

  setActive: async (id) => {
    if (!get().companies.find((c) => c.id === id)) {
      toast.error(`Company ${id} not found.`);
      return;
    }
    set({ activeCompanyId: id });
    await window.api.settings.set({ activeCompanyId: id });
    // Downstream stores listen via subscribe() in App.tsx — see Phase 4
    // wiring there. We don't reach into brandStore/productStore here to
    // keep the dependency graph one-way (companyStore → others).
  },

  create: async (input) => {
    const created = await window.api.company.create(input);
    set({ companies: [...get().companies, created] });
    toast.success(`Company "${created.name}" created.`);
    return created;
  },

  update: async (id, patch) => {
    const updated = await window.api.company.update(id, patch);
    if (updated) {
      set({
        companies: get().companies.map((c) => (c.id === id ? updated : c)),
      });
    }
    return updated;
  },

  remove: async (id) => {
    try {
      const ok = await window.api.company.remove(id);
      if (ok) {
        set({ companies: get().companies.filter((c) => c.id !== id) });
        // If we just removed the active company, pick a new one.
        if (get().activeCompanyId === id) {
          const next = get().companies[0];
          if (next) await get().setActive(next.id);
        }
        toast.info('Company deleted.');
      }
      return ok;
    } catch (err) {
      toast.error(String(err));
      return false;
    }
  },
}));
