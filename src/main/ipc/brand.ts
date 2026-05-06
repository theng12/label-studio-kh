import { ipcMain } from 'electron';
import { BrandService } from '../services/BrandService';
import type { NewBrandInput } from '@shared/types/brand';

export function registerBrandIpc(): void {
  ipcMain.handle('brand:list', () => BrandService.list());
  ipcMain.handle('brand:get', (_e, id: string) => BrandService.get(id));
  ipcMain.handle('brand:create', (_e, input: NewBrandInput) => BrandService.create(input));
  ipcMain.handle('brand:update', (_e, id: string, patch: Partial<NewBrandInput>) =>
    BrandService.update(id, patch),
  );
  ipcMain.handle('brand:delete', (_e, id: string) => BrandService.delete(id));
}
