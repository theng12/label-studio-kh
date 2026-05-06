import { create } from 'zustand';

interface LicenseState {
  licensed: boolean;
  name?: string;
  loading: boolean;
  refresh: () => Promise<void>;
  activate: (name: string, key: string) => Promise<boolean>;
  deactivate: () => Promise<void>;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  licensed: false,
  name: undefined,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    const status = await window.api.license.status();
    set({ licensed: status.licensed, name: status.name, loading: false });
  },
  activate: async (name, key) => {
    const status = await window.api.license.activate(name, key);
    set({ licensed: status.licensed, name: status.name });
    return status.licensed;
  },
  deactivate: async () => {
    const status = await window.api.license.deactivate();
    set({ licensed: status.licensed, name: status.name });
  },
}));
