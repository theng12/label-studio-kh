import { contextBridge, ipcRenderer } from 'electron';
import type { Brand, NewBrandInput } from '../shared/types/brand';
import type { Template, NewTemplateInput } from '../shared/types/template';
import type {
  ColumnMapping,
  CommitInput,
  CommitResult,
  ParsedFile,
  SkuConflict,
  ValidationResult,
} from '../shared/types/import';
import type {
  Product,
  ProductFilters,
  ProductInput,
} from '../shared/types/product';
import type { Company, CompanyInput } from '../shared/types/company';
import type { SheetLayout } from '../shared/sheetLayout';

interface ImportListEntry {
  id: string;
  source_filename: string | null;
  brand_id: string | null;
  row_count: number;
  created_at: string;
}

interface SkuRow {
  sku: string;
  brand_id: string;
  product_name: string | null;
  barcode: string | null;
  description: string | null;
  variant: string | null;
  unit_qty: string | null;
  unit_word: string | null;
  product_url: string | null;
  product_image_path: string | null;
  date: string | null;
  notes: string | null;
  extra_json: string | null;
}

export type ExportFormat = 'pdf' | 'png' | 'jpeg';

export interface ExportSettings {
  formats: ExportFormat[];
  dpi: 150 | 300 | 600;
  outputDir: string;
  filenamePattern: string;
  folderOrganization: 'none' | 'brand' | 'brand_size' | 'brand_template';
  overwrite: boolean;
}

export interface ExportProgressInfo {
  index: number;
  total: number;
  sku: string;
  result: { files: string[]; errors: string[] };
}

export interface BulkExportSummary {
  batchId: string;
  total: number;
  generated: number;
  errors: string[];
  outputDir: string;
}

const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    getInfo: (): Promise<{
      name: string;
      version: string;
      electronVersion: string;
      nodeVersion: string;
      chromeVersion: string;
      platform: NodeJS.Platform;
      isDev: boolean;
    }> => ipcRenderer.invoke('app:getInfo'),
    getFontStatus: (): Promise<{
      loaded: string[];
      missing: string[];
      total: number;
    }> => ipcRenderer.invoke('app:getFontStatus'),
    getAssetsDir: (): Promise<string> => ipcRenderer.invoke('app:getAssetsDir'),
  },
  brand: {
    list: (companyId?: string): Promise<Brand[]> =>
      ipcRenderer.invoke('brand:list', companyId),
    get: (id: string): Promise<Brand | null> => ipcRenderer.invoke('brand:get', id),
    create: (input: NewBrandInput): Promise<Brand> =>
      ipcRenderer.invoke('brand:create', input),
    update: (id: string, patch: Partial<NewBrandInput>): Promise<Brand | null> =>
      ipcRenderer.invoke('brand:update', id, patch),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('brand:delete', id),
    restore: (id: string): Promise<Brand | null> =>
      ipcRenderer.invoke('brand:restore', id),
    importAsset: (
      brandId: string,
      sourcePath: string,
      kind: 'logo' | 'cert',
    ): Promise<string> =>
      ipcRenderer.invoke('brand:importAsset', brandId, sourcePath, kind),
    removeAsset: (filePath: string): Promise<boolean> =>
      ipcRenderer.invoke('brand:removeAsset', filePath),
  },
  dialog: {
    pickImage: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickImage'),
    pickImages: (): Promise<string[]> => ipcRenderer.invoke('dialog:pickImages'),
  },
  barcode: {
    generateBatch: (payload: {
      runId: string;
      input: {
        values: string[];
        format: 'EAN-13' | 'Code128' | 'Code39' | 'UPC-A';
        output: 'svg' | 'png';
        outputDir: string;
        width_mm: number;
        height_mm: number;
        showText: boolean;
        filenamePrefix: string;
        dpi: 150 | 300 | 600;
        fillEmpty: boolean;
      };
    }): Promise<{ generated: number; files: string[]; errors: string[] }> =>
      ipcRenderer.invoke('barcode:generateBatch', payload),
    cancel: (runId: string): Promise<void> =>
      ipcRenderer.invoke('barcode:cancel', runId),
    onProgress: (
      runId: string,
      cb: (info: { index: number; total: number; value: string }) => void,
    ): (() => void) => {
      const channel = `barcode:progress:${runId}`;
      const handler = (_e: unknown, info: { index: number; total: number; value: string }) =>
        cb(info);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
  template: {
    listForBrand: (brandId: string): Promise<Template[]> =>
      ipcRenderer.invoke('template:listForBrand', brandId),
    get: (brandId: string, templateId: string): Promise<Template | null> =>
      ipcRenderer.invoke('template:get', brandId, templateId),
    save: (input: Template | NewTemplateInput): Promise<Template> =>
      ipcRenderer.invoke('template:save', input),
    delete: (brandId: string, templateId: string): Promise<boolean> =>
      ipcRenderer.invoke('template:delete', brandId, templateId),
    duplicate: (brandId: string, templateId: string): Promise<Template | null> =>
      ipcRenderer.invoke('template:duplicate', brandId, templateId),
  },
  import: {
    pickFile: (): Promise<string | null> => ipcRenderer.invoke('import:pickFile'),
    parseFile: (path: string): Promise<ParsedFile> =>
      ipcRenderer.invoke('import:parseFile', path),
    autoMap: (columns: string[]): Promise<ColumnMapping> =>
      ipcRenderer.invoke('import:autoMap', columns),
    validate: (
      rows: Record<string, string>[],
      mapping: ColumnMapping,
    ): Promise<ValidationResult> =>
      ipcRenderer.invoke('import:validate', rows, mapping),
    findConflicts: (
      brandId: string,
      rows: Record<string, string>[],
      mapping: ColumnMapping,
    ): Promise<SkuConflict[]> =>
      ipcRenderer.invoke('import:findConflicts', brandId, rows, mapping),
    commit: (input: CommitInput): Promise<CommitResult> =>
      ipcRenderer.invoke('import:commit', input),
    listSkus: (brandId: string): Promise<SkuRow[]> =>
      ipcRenderer.invoke('import:listSkus', brandId),
    listImports: (brandId?: string): Promise<ImportListEntry[]> =>
      ipcRenderer.invoke('import:listImports', brandId),
    deleteImport: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('import:deleteImport', id),
    clearImports: (brandId?: string): Promise<number> =>
      ipcRenderer.invoke('import:clearImports', brandId),
  },
  dashboard: {
    stats: (
      companyId?: string,
    ): Promise<{
      brandCount: number;
      skuCount: number;
      totalGenerated: number;
      timeSavedMinutes: number;
    }> => ipcRenderer.invoke('dashboard:stats', companyId),
    recentBrands: (
      limit?: number,
      companyId?: string,
    ): Promise<
      Array<{
        id: string;
        name: string;
        color: string;
        templateCount: number;
        updatedAt: string;
      }>
    > => ipcRenderer.invoke('dashboard:recentBrands', limit, companyId),
    recentActivity: (
      limit?: number,
      companyId?: string,
    ): Promise<
      Array<{ type: 'import' | 'export'; at: string; summary: string; detail: string }>
    > => ipcRenderer.invoke('dashboard:recentActivity', limit, companyId),
  },
  files: {
    list: (filters: {
      query?: string;
      companyId?: string;
      brandId?: string;
      format?: 'pdf' | 'png' | 'jpeg';
      dateFrom?: string;
      dateTo?: string;
      sizeLabel?: string;
      batchId?: string;
    }): Promise<
      Array<{
        id: string;
        batch_id: string | null;
        sku: string;
        brand_id: string;
        brand_name: string | null;
        template_id: string;
        format: string;
        dpi: number;
        size_label: string;
        file_path: string;
        file_size: number | null;
        created_at: string;
        exists: boolean;
      }>
    > => ipcRenderer.invoke('file:list', filters),
    listPaged: (opts: {
      filters: {
        query?: string;
        companyId?: string;
        brandId?: string;
        format?: 'pdf' | 'png' | 'jpeg';
        dateFrom?: string;
        dateTo?: string;
        sizeLabel?: string;
        batchId?: string;
      };
      sortKey?:
        | 'created_at'
        | 'sku'
        | 'brand'
        | 'size_label'
        | 'format'
        | 'dpi'
        | 'file_path';
      sortDir?: 'asc' | 'desc';
      page?: number;
      pageSize?: number;
    }): Promise<{
      total: number;
      rows: Array<{
        id: string;
        batch_id: string | null;
        sku: string;
        brand_id: string;
        brand_name: string | null;
        template_id: string;
        format: string;
        dpi: number;
        size_label: string;
        file_path: string;
        file_size: number | null;
        created_at: string;
        exists: boolean;
      }>;
    }> => ipcRenderer.invoke('file:listPaged', opts),
    distinctSizes: (companyId?: string): Promise<string[]> =>
      ipcRenderer.invoke('file:distinctSizes', companyId),
    storageStats: (
      companyId?: string,
    ): Promise<{
      totalFiles: number;
      totalBytes: number;
      byFormat: Record<string, { count: number; bytes: number }>;
    }> => ipcRenderer.invoke('file:storageStats', companyId),
    delete: (id: string, alsoFromDisk: boolean): Promise<boolean> =>
      ipcRenderer.invoke('file:delete', id, alsoFromDisk),
    restore: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('file:restore', id),
    reprint: (
      id: string,
    ): Promise<{ files: string[]; errors: string[] } | null> =>
      ipcRenderer.invoke('file:reprint', id),
  },
  company: {
    list: (): Promise<Company[]> => ipcRenderer.invoke('company:list'),
    get: (id: string): Promise<Company | null> =>
      ipcRenderer.invoke('company:get', id),
    create: (input: CompanyInput): Promise<Company> =>
      ipcRenderer.invoke('company:create', input),
    update: (
      id: string,
      patch: Partial<CompanyInput>,
    ): Promise<Company | null> =>
      ipcRenderer.invoke('company:update', id, patch),
    remove: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('company:remove', id),
  },
  products: {
    list: (filters?: ProductFilters): Promise<Product[]> =>
      ipcRenderer.invoke('products:list', filters),
    get: (id: string): Promise<Product | null> =>
      ipcRenderer.invoke('products:get', id),
    getBySku: (brandId: string, sku: string): Promise<Product | null> =>
      ipcRenderer.invoke('products:getBySku', brandId, sku),
    create: (input: ProductInput): Promise<Product> =>
      ipcRenderer.invoke('products:create', input),
    update: (
      id: string,
      patch: Partial<ProductInput>,
    ): Promise<Product | null> =>
      ipcRenderer.invoke('products:update', id, patch),
    remove: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('products:remove', id),
    bulkUpsert: (
      rows: ProductInput[],
    ): Promise<{ inserted: number; updated: number }> =>
      ipcRenderer.invoke('products:bulkUpsert', rows),
    categories: (brandId?: string): Promise<string[]> =>
      ipcRenderer.invoke('products:categories', brandId),
    /** Product count grouped by brand_id. Optional company scope.
     *  Used by /brands cards to render "N products" badges without
     *  pulling the full product list per brand. */
    countsByBrand: (companyId?: string): Promise<Record<string, number>> =>
      ipcRenderer.invoke('products:countsByBrand', companyId),
    addImage: (id: string, relativePath: string): Promise<Product | null> =>
      ipcRenderer.invoke('products:addImage', id, relativePath),
    removeImage: (id: string, relativePath: string): Promise<Product | null> =>
      ipcRenderer.invoke('products:removeImage', id, relativePath),
    setMainImage: (
      id: string,
      relativePath: string,
    ): Promise<Product | null> =>
      ipcRenderer.invoke('products:setMainImage', id, relativePath),
    reorderImages: (
      id: string,
      newOrder: string[],
    ): Promise<Product | null> =>
      ipcRenderer.invoke('products:reorderImages', id, newOrder),
    /** Opens the OS file picker. Returns the absolute path or null. */
    pickImageFile: (): Promise<string | null> =>
      ipcRenderer.invoke('products:pickImageFile'),
    /** Copy a file from disk into the product's image library. Returns the
     *  updated product (with the new image appended) or null if not found. */
    importImage: (
      productId: string,
      sourcePath: string,
    ): Promise<Product | null> =>
      ipcRenderer.invoke('products:importImage', productId, sourcePath),
    /** Clipboard-paste path: send the raw bytes + an extension hint. */
    importImageFromBytes: (
      productId: string,
      bytes: ArrayBuffer,
      ext: string,
    ): Promise<Product | null> =>
      ipcRenderer.invoke('products:importImageFromBytes', productId, bytes, ext),
    /** Opens the OS folder picker for the auto-match flow. */
    pickImageFolder: (): Promise<string | null> =>
      ipcRenderer.invoke('products:pickImageFolder'),
    /** Recursively scans the folder, matches files to SKUs in this company,
     *  copies them into the asset store, and updates product image arrays.
     *  Returns rich stats for the results screen. */
    autoMatchImages: (
      companyId: string,
      folderPath: string,
    ): Promise<{
      scannedFiles: number;
      matchedSkus: number;
      totalProducts: number;
      imagesImported: number;
      imagesSkippedDup: number;
      imagesSkippedCap: number;
      unmatchedFiles: number;
      productsTouched: number;
      maxImagesPerProduct: number;
    }> =>
      ipcRenderer.invoke('products:autoMatchImages', companyId, folderPath),
  },
  sku: {
    get: (brandId: string, sku: string): Promise<SkuRow | null> =>
      ipcRenderer.invoke('sku:get', brandId, sku),
    upsert: (input: {
      sku: string;
      brand_id: string;
      product_name?: string | null;
      barcode?: string | null;
      description?: string | null;
      variant?: string | null;
      unit_qty?: string | null;
      unit_word?: string | null;
      product_url?: string | null;
      product_image_path?: string | null;
      date?: string | null;
      notes?: string | null;
      extra_json?: string | null;
    }): Promise<SkuRow | null> => ipcRenderer.invoke('sku:upsert', input),
    delete: (brandId: string, sku: string): Promise<boolean> =>
      ipcRenderer.invoke('sku:delete', brandId, sku),
  },
  settings: {
    get: (): Promise<{
      defaultSaveLocation: string;
      defaultNamingPattern: string;
      defaultExportFormat: 'pdf' | 'png' | 'jpeg' | 'all';
      defaultDpi: 150 | 300 | 600;
      timeSavedMinutesPerLabel: number;
      snapGridMm: number;
      sizeWarningAreaMm2: number;
      uiLanguage: string;
      lastUsedBrandId: string | null;
      activeCompanyId: string | null;
    }> => ipcRenderer.invoke('settings:get'),
    set: (patch: Record<string, unknown>): Promise<unknown> =>
      ipcRenderer.invoke('settings:set', patch),
  },
  export: {
    pickFolder: (defaultPath?: string): Promise<string | null> =>
      ipcRenderer.invoke('export:pickFolder', defaultPath),
    openInOS: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('export:openInOS', filePath),
    revealInFinder: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('export:revealInFinder', filePath),
    single: (input: {
      template: Template;
      brand: Brand | null;
      row: Record<string, string>;
      index: number;
      total: number;
      settings: ExportSettings;
      batchId?: string;
    }): Promise<{ files: string[]; errors: string[] }> =>
      ipcRenderer.invoke('export:single', input),
    /** Export one combined N-up PDF (multiple labels per sheet) to a file. */
    sheetPdf: (input: {
      template: Template;
      brand: Brand | null;
      rows: Record<string, string>[];
      sheet: SheetLayout;
      outputDir: string;
      filename?: string;
      overwrite?: boolean;
    }): Promise<{ file: string }> =>
      ipcRenderer.invoke('export:sheetPdf', input),
    bulk: (payload: {
      runId: string;
      template: Template;
      brand: Brand | null;
      rows: Record<string, string>[];
      settings: ExportSettings;
    }): Promise<BulkExportSummary> => ipcRenderer.invoke('export:bulk', payload),
    cancel: (runId: string): Promise<void> =>
      ipcRenderer.invoke('export:cancel', runId),
    onProgress: (
      runId: string,
      cb: (info: ExportProgressInfo) => void,
    ): (() => void) => {
      const channel = `export:progress:${runId}`;
      const handler = (_e: unknown, info: ExportProgressInfo) => cb(info);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
  print: {
    /** Enumerate installed OS printers (incl. thermal/roll printers with
     *  drivers). Used to populate the printer picker on the Generate page. */
    listPrinters: (): Promise<
      Array<{
        name: string;
        displayName: string;
        description: string;
        isDefault: boolean;
        status: number;
      }>
    > => ipcRenderer.invoke('print:listPrinters'),
    /** Render + print labels. silent=true prints straight to deviceName
     *  with no dialog; silent=false shows the native print dialog. */
    labels: (input: {
      template: Template;
      brand: Brand | null;
      rows: Record<string, string>[];
      deviceName?: string;
      copies?: number;
      silent?: boolean;
      /** Provide to tile N-up onto A4/Letter sheets; omit for one-per-page. */
      sheet?: SheetLayout | null;
    }): Promise<{ printed: number; copies: number }> =>
      ipcRenderer.invoke('print:labels', input),
  },
  audit: {
    /** Global audit-log feed for the History page. Newest first.
     *  Optional filters by company + entity type; offset/limit for paging. */
    listRecent: (opts?: {
      companyId?: string | null;
      entityType?:
        | 'product'
        | 'image'
        | 'brand'
        | 'company'
        | 'template'
        | 'import'
        | null;
      limit?: number;
      offset?: number;
    }): Promise<
      Array<{
        id: number;
        entityType: string;
        entityId: string | null;
        companyId: string | null;
        action: string;
        summary: string | null;
        before: unknown;
        after: unknown;
        createdAt: string;
      }>
    > => ipcRenderer.invoke('audit:listRecent', opts),
    countRecent: (opts?: {
      companyId?: string | null;
      entityType?:
        | 'product'
        | 'image'
        | 'brand'
        | 'company'
        | 'template'
        | 'import'
        | null;
    }): Promise<number> => ipcRenderer.invoke('audit:countRecent', opts),
  },
  generations: {
    /** Historical batches grouped from the `generations` table. Newest first;
     *  capped at `limit` (default 100). Used by the Jobs page to show
     *  generation history alongside the in-memory running-jobs list. */
    listBatches: (
      companyId?: string,
      limit?: number,
    ): Promise<
      Array<{
        batchId: string;
        brandId: string;
        brandName: string | null;
        templateId: string;
        companyId: string | null;
        sizeLabels: string[];
        formats: string[];
        fileCount: number;
        skuCount: number;
        startedAt: string;
        finishedAt: string;
        totalBytes: number | null;
      }>
    > => ipcRenderer.invoke('generations:listBatches', companyId, limit),
  },
  updater: {
    /** Quit the app and install the previously-downloaded update. */
    quitAndInstall: (): Promise<boolean> =>
      ipcRenderer.invoke('updater:quitAndInstall'),
    /** Manually trigger a check; resolves with the latest available version. */
    checkNow: (): Promise<{ ok: boolean; version?: string | null; reason?: string }> =>
      ipcRenderer.invoke('updater:checkNow'),
    /**
     * Subscribe to "update-downloaded" pushes from the main process. Returns
     * an unsubscribe function. The payload carries the version that just
     * finished downloading.
     */
    onUpdateDownloaded: (
      cb: (info: { version: string; releaseDate: string | null }) => void,
    ): (() => void) => {
      const handler = (
        _e: unknown,
        info: { version: string; releaseDate: string | null },
      ) => cb(info);
      ipcRenderer.on('updater:update-downloaded', handler);
      return () =>
        ipcRenderer.removeListener('updater:update-downloaded', handler);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
