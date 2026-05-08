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
  },
  brand: {
    list: (): Promise<Brand[]> => ipcRenderer.invoke('brand:list'),
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
    demoSamplePath: (): Promise<string | null> =>
      ipcRenderer.invoke('import:demoSamplePath'),
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
  },
  dashboard: {
    stats: (): Promise<{
      brandCount: number;
      skuCount: number;
      totalGenerated: number;
      timeSavedMinutes: number;
    }> => ipcRenderer.invoke('dashboard:stats'),
    recentBrands: (
      limit?: number,
    ): Promise<
      Array<{
        id: string;
        name: string;
        color: string;
        templateCount: number;
        updatedAt: string;
      }>
    > => ipcRenderer.invoke('dashboard:recentBrands', limit),
    recentActivity: (
      limit?: number,
    ): Promise<
      Array<{ type: 'import' | 'export'; at: string; summary: string; detail: string }>
    > => ipcRenderer.invoke('dashboard:recentActivity', limit),
  },
  files: {
    list: (filters: {
      query?: string;
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
    distinctSizes: (): Promise<string[]> => ipcRenderer.invoke('file:distinctSizes'),
    delete: (id: string, alsoFromDisk: boolean): Promise<boolean> =>
      ipcRenderer.invoke('file:delete', id, alsoFromDisk),
    restore: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('file:restore', id),
    reprint: (
      id: string,
    ): Promise<{ files: string[]; errors: string[] } | null> =>
      ipcRenderer.invoke('file:reprint', id),
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
  license: {
    status: (): Promise<{ licensed: boolean; name?: string }> =>
      ipcRenderer.invoke('license:status'),
    activate: (
      name: string,
      key: string,
    ): Promise<{ licensed: boolean; name?: string }> =>
      ipcRenderer.invoke('license:activate', name, key),
    deactivate: (): Promise<{ licensed: boolean; name?: string }> =>
      ipcRenderer.invoke('license:deactivate'),
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
      hideDemoBrand: boolean;
      uiLanguage: string;
      lastUsedBrandId: string | null;
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
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
