import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

// App-level settings persisted as JSON. Distinct from theme/UI preferences,
// which live in localStorage in the renderer.
export interface AppSettings {
  defaultSaveLocation: string;
  defaultNamingPattern: string;
  defaultExportFormat: 'pdf' | 'png' | 'jpeg' | 'all';
  defaultDpi: 150 | 300 | 600;
  timeSavedMinutesPerLabel: number;
  snapGridMm: number;
  sizeWarningAreaMm2: number;
  hideDemoBrand: boolean;
  uiLanguage: string;
  /** Last brand the user explicitly picked in Templates / Generate / Data Import.
   *  Used as the default selection on next launch so brand-scoped pages don't
   *  reset to the alphabetically-first brand (which is usually "Demo brand"). */
  lastUsedBrandId: string | null;
}

let cache: AppSettings | null = null;

function file(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function defaults(): AppSettings {
  return {
    defaultSaveLocation: join(app.getPath('documents'), 'Label Studio KH', 'exports'),
    defaultNamingPattern: '{SKU}_{Size}',
    defaultExportFormat: 'pdf',
    defaultDpi: 300,
    timeSavedMinutesPerLabel: 4,
    snapGridMm: 1,
    sizeWarningAreaMm2: 400,
    hideDemoBrand: false,
    uiLanguage: 'en',
    lastUsedBrandId: null,
  };
}

export const SettingsService = {
  get(): AppSettings {
    if (cache) return cache;
    const path = file();
    if (!existsSync(path)) {
      cache = defaults();
      return cache;
    }
    try {
      const raw = readFileSync(path, 'utf8');
      cache = { ...defaults(), ...(JSON.parse(raw) as Partial<AppSettings>) };
      return cache;
    } catch (err) {
      console.error('Failed to read settings.json:', err);
      cache = defaults();
      return cache;
    }
  },

  set(patch: Partial<AppSettings>): AppSettings {
    const next = { ...this.get(), ...patch };
    cache = next;
    writeFileSync(file(), JSON.stringify(next, null, 2), 'utf8');
    return next;
  },
};
