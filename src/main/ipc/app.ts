import { app, ipcMain } from 'electron';
import { getFontStatus } from '../services/FontService';
import { getAssetsRootDir } from '../services/ProductImageManager';

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

  ipcMain.handle('app:getFontStatus', () => getFontStatus());

  // Renderer needs the assets root to build lskh-file:// URLs from the
  // relative paths stored in Product.images. Called once on Product Library
  // mount and cached client-side.
  ipcMain.handle('app:getAssetsDir', (): string => getAssetsRootDir());
}
