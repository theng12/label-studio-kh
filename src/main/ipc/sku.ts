import { ipcMain } from 'electron';
import { SkuService, type SkuInput } from '../services/SkuService';

export function registerSkuIpc(): void {
  ipcMain.handle('sku:get', (_e, brandId: string, sku: string) =>
    SkuService.get(brandId, sku),
  );
  ipcMain.handle('sku:upsert', (_e, input: SkuInput) => SkuService.upsert(input));
  ipcMain.handle('sku:delete', (_e, brandId: string, sku: string) =>
    SkuService.delete(brandId, sku),
  );
}
