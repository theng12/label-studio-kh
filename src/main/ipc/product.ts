// Product Library IPC. Channel names follow `products:action` per spec §10.
// Image operations are gathered here too (rather than a separate `images:`
// domain) since they all mutate Product rows; spec uses `images:` because
// that infra also covers brands/companies, but our app already has a
// separate brand-image flow in BrandService — keeping these alongside
// products avoids ambiguity about which entity is being mutated.

import { ipcMain, dialog } from 'electron';
import { ProductService } from '../services/ProductService';
import {
  importProductImageFromPath,
  importProductImageFromBytes,
} from '../services/ProductImageManager';
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

  // Image-import IPC. Two entry points: file picker (path-based) and
  // clipboard paste (bytes-based). Both end up in the same dedup pipeline
  // in ProductImageManager.

  ipcMain.handle('products:pickImageFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Add image to product',
      properties: ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
        },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    'products:importImage',
    async (_e, productId: string, sourcePath: string) => {
      const product = ProductService.get(productId);
      if (!product) throw new Error('Product not found');
      const { relativePath } = await importProductImageFromPath(
        sourcePath,
        product.sku,
      );
      return ProductService.addImageToProduct(productId, relativePath);
    },
  );

  ipcMain.handle(
    'products:importImageFromBytes',
    async (
      _e,
      productId: string,
      bytes: ArrayBuffer,
      ext: string,
    ) => {
      const product = ProductService.get(productId);
      if (!product) throw new Error('Product not found');
      const { relativePath } = await importProductImageFromBytes(
        bytes,
        ext,
        product.sku,
      );
      return ProductService.addImageToProduct(productId, relativePath);
    },
  );

  // Auto-match: user picks a folder of images; backend scans recursively,
  // figures out which SKU each file belongs to, and attaches it.
  // Separate channel from export:pickFolder so the dialog title makes
  // sense in context.
  ipcMain.handle('products:pickImageFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Pick a folder of product images',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    'products:autoMatchImages',
    async (_e, companyId: string, folderPath: string) =>
      ProductService.autoMatchImagesBySku(companyId, folderPath),
  );
}
