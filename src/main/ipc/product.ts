// Product Library IPC. Channel names follow `products:action` per spec §10.
// Image operations are gathered here too (rather than a separate `images:`
// domain) since they all mutate Product rows; spec uses `images:` because
// that infra also covers brands/companies, but our app already has a
// separate brand-image flow in BrandService — keeping these alongside
// products avoids ambiguity about which entity is being mutated.

import { ipcMain } from 'electron';
import { ProductService } from '../services/ProductService';
import type {
  ProductInput,
  ProductFilters,
} from '@shared/types/product';

export function registerProductIpc(): void {
  ipcMain.handle('products:list', (_e, filters: ProductFilters | undefined) =>
    ProductService.list(filters ?? {}),
  );

  ipcMain.handle('products:get', (_e, id: string) => ProductService.get(id));

  ipcMain.handle('products:getBySku', (_e, brandId: string, sku: string) =>
    ProductService.getBySku(brandId, sku),
  );

  ipcMain.handle('products:create', (_e, input: ProductInput) =>
    ProductService.create(input),
  );

  ipcMain.handle(
    'products:update',
    (_e, id: string, patch: Partial<ProductInput>) =>
      ProductService.update(id, patch),
  );

  ipcMain.handle('products:remove', (_e, id: string) =>
    ProductService.remove(id),
  );

  ipcMain.handle(
    'products:bulkUpsert',
    (_e, rows: ProductInput[]) => ProductService.bulkUpsert(rows),
  );

  ipcMain.handle('products:categories', (_e, brandId?: string) =>
    ProductService.categories(brandId),
  );

  // Image operations on products. Phase 2 wires these to the actual
  // file-import pipeline (sharp + content-hash dedup). Phase 1 ships
  // the array-management primitives so the type contract is stable.
  ipcMain.handle(
    'products:addImage',
    (_e, id: string, relativePath: string) =>
      ProductService.addImageToProduct(id, relativePath),
  );

  ipcMain.handle(
    'products:removeImage',
    (_e, id: string, relativePath: string) =>
      ProductService.removeImageFromProduct(id, relativePath),
  );

  ipcMain.handle(
    'products:setMainImage',
    (_e, id: string, relativePath: string) =>
      ProductService.setMainImage(id, relativePath),
  );

  ipcMain.handle(
    'products:reorderImages',
    (_e, id: string, newOrder: string[]) =>
      ProductService.reorderImages(id, newOrder),
  );
}
