import { ipcMain } from 'electron';
import { SettingsService, type AppSettings } from '../services/SettingsService';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => SettingsService.get());
  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) =>
    SettingsService.set(patch),
  );
}
