import { ipcMain } from 'electron';
import { BrandService } from '../services/BrandService';
import { AssetService } from '../services/AssetService';
import type { NewBrandInput } from '@shared/types/brand';

export function registerBrandIpc(): void {
  ipcMain.handle('brand:list', (_e, companyId?: string) =>
    BrandService.list(companyId),
  );
  ipcMain.handle('brand:get', (_e, id: string) => BrandService.get(id));
  ipcMain.handle('brand:create', (_e, input: NewBrandInput) => BrandService.create(input));
  ipcMain.handle('brand:update', (_e, id: string, patch: Partial<NewBrandInput>) =>
    BrandService.update(id, patch),
  );
  ipcMain.handle('brand:delete', (_e, id: string) => BrandService.delete(id));
  ipcMain.handle('brand:restore', (_e, id: string) => BrandService.restore(id));

  // Copies a user-picked file into the brand's assets folder. Returns the new
  // permanent path. Caller is responsible for storing it on the brand.
  ipcMain.handle(
    'brand:importAsset',
    (_e, brandId: string, sourcePath: string, kind: 'logo' | 'cert') =>
      AssetService.importFile(brandId, sourcePath, kind),
  );

  ipcMain.handle('brand:removeAsset', (_e, filePath: string) => {
    AssetService.removeFile(filePath);
    return true;
  });
}
