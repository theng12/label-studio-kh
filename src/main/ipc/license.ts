import { ipcMain } from 'electron';
import { LicenseService } from '../services/LicenseService';

export function registerLicenseIpc(): void {
  ipcMain.handle('license:status', () => LicenseService.status());
  ipcMain.handle('license:activate', (_e, name: string, key: string) =>
    LicenseService.activate(name, key),
  );
  ipcMain.handle('license:deactivate', () => LicenseService.deactivate());
}
