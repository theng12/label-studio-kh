import { create } from 'zustand';

type AppSettings = Awaited<ReturnType<typeof window.api.settings.get>>;

interface SettingsState {
  settings: AppSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
  set: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    const s = await window.api.settings.get();
    set({ settings: s, loading: false });
  },
  set: async (patch) => {
    const next = (await window.api.settings.set(patch)) as AppSettings;
    set({ settings: next });
    void get();
  },
}));
