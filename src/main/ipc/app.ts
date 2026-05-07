import { app, ipcMain } from 'electron';

export interface AppInfo {
  name: string;
  version: string;
  electronVersion: string;
  nodeVersion: string;
  chromeVersion: string;
  platform: NodeJS.Platform;
  isDev: boolean;
}

export function registerAppIpc(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('app:getInfo', (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    electronVersion: process.versions.electron ?? 'unknown',
    nodeVersion: process.versions.node ?? 'unknown',
    chromeVersion: process.versions.chrome ?? 'unknown',
    platform: process.platform,
    isDev: !app.isPackaged,
  }));
}
