import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  init: () => void;
}

const STORAGE_KEY = 'lskh.theme';

function getSystemPref(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemPref() : mode;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  resolved: 'light',
  setMode: (mode) => {
    const resolved = resolve(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(resolved);
    set({ mode, resolved });
  },
  init: () => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'system';
    const resolved = resolve(stored);
    applyTheme(resolved);
    set({ mode: stored, resolved });

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (get().mode === 'system') {
        const r = getSystemPref();
        applyTheme(r);
        set({ resolved: r });
      }
    });
  },
}));
