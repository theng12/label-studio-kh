import { unlinkSync, existsSync } from 'node:fs';
import { getDb } from './Database';
import { BrandService } from './BrandService';
import { exportSingle, type ExportFormat } from './ExportService';
import type { Template } from '@shared/types/template';
import type { Brand } from '@shared/types/brand';

export interface FileEntry {
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
}

export interface FileFilters {
  query?: string; // matches sku, file_path
  brandId?: string;
  format?: 'pdf' | 'png' | 'jpeg';
  dateFrom?: string;
  dateTo?: string;
  sizeLabel?: string;
  batchId?: string;
}

export const FileService = {
  list(filters: FileFilters, limit = 500): FileEntry[] {
    const db = getDb();
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.query) {
      where.push('(sku LIKE ? OR file_path LIKE ?)');
      params.push(`%${filters.query}%`, `%${filters.query}%`);
    }
    if (filters.brandId) {
      where.push('brand_id = ?');
      params.push(filters.brandId);
    }
    if (filters.format) {
      where.push('format = ?');
      params.push(filters.format);
    }
    if (filters.sizeLabel) {
      where.push('size_label = ?');
      params.push(filters.sizeLabel);
    }
    if (filters.dateFrom) {
      where.push('created_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      where.push('created_at <= ?');
      params.push(filters.dateTo);
    }
    if (filters.batchId) {
      where.push('batch_id = ?');
      params.push(filters.batchId);
    }

    const sql = `SELECT id, batch_id, sku, brand_id, template_id, format, dpi, size_label, file_path, file_size, created_at
                 FROM generations
                 ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY created_at DESC
                 LIMIT ${limit}`;

    const rows = db.prepare(sql).all(...params) as Array<{
      id: string;
      batch_id: string | null;
      sku: string;
      brand_id: string;
      template_id: string;
      format: string;
      dpi: number;
      size_label: string;
      file_path: string;
      file_size: number | null;
      created_at: string;
    }>;

    const brands = BrandService.list();
    const brandMap = new Map(brands.map((b) => [b.id, b]));

    return rows.map((r) => ({
      ...r,
      brand_name: brandMap.get(r.brand_id)?.name ?? null,
      exists: existsSync(r.file_path),
    }));
  },

  distinctSizes(): string[] {
    const db = getDb();
    const rows = db
      .prepare(`SELECT DISTINCT size_label FROM generations ORDER BY size_label`)
      .all() as Array<{ size_label: string }>;
    return rows.map((r) => r.size_label);
  },

  delete(id: string, alsoFromDisk: boolean): boolean {
    const db = getDb();
    const row = db
      .prepare(`SELECT file_path FROM generations WHERE id = ?`)
      .get(id) as { file_path: string } | undefined;
    if (!row) return false;

    if (alsoFromDisk) {
      try {
        if (existsSync(row.file_path)) unlinkSync(row.file_path);
      } catch (err) {
        console.error('Failed to delete file from disk:', err);
      }
    }
    db.prepare(`DELETE FROM generations WHERE id = ?`).run(id);
    return true;
  },

  /**
   * Reprint a generation using the *original* template + data snapshot saved at
   * generation time. This guarantees the file is identical to the original even
   * if the live template has since changed.
   */
  async reprint(id: string): Promise<{ files: string[]; errors: string[] } | null> {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, sku, brand_id, template_id, format, dpi, size_label, file_path, template_snapshot, data_snapshot, brand_snapshot
         FROM generations
         WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          sku: string;
          brand_id: string;
          template_id: string;
          format: string;
          dpi: number;
          size_label: string;
          file_path: string;
          template_snapshot: string | null;
          data_snapshot: string | null;
          brand_snapshot: string | null;
        }
      | undefined;

    if (!row || !row.template_snapshot || !row.data_snapshot) return null;

    const template = JSON.parse(row.template_snapshot) as Template;
    const dataRow = JSON.parse(row.data_snapshot) as Record<string, string>;
    // Pre-migration rows have no brand_snapshot — fall back to live brand so
    // older generations stay re-printable.
    const brand: Brand | null = row.brand_snapshot
      ? (JSON.parse(row.brand_snapshot) as Brand)
      : BrandService.get(row.brand_id);

    // Output directory and filename are the file_path's directory and base.
    const lastSlash = row.file_path.lastIndexOf('/');
    const outputDir = lastSlash > 0 ? row.file_path.slice(0, lastSlash) : '';
    const fullName = lastSlash > 0 ? row.file_path.slice(lastSlash + 1) : row.file_path;
    const dotIdx = fullName.lastIndexOf('.');
    const baseName = dotIdx > 0 ? fullName.slice(0, dotIdx) : fullName;

    return exportSingle({
      template,
      brand,
      row: dataRow,
      index: 0,
      total: 1,
      batchId: 'reprint',
      settings: {
        formats: [row.format as ExportFormat],
        dpi: row.dpi as 150 | 300 | 600,
        outputDir,
        filenamePattern: baseName, // exact original filename
        folderOrganization: 'none',
        overwrite: true,
      },
    });
  },
};
