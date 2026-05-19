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
  /** Scope to a single Company. The File Manager defaults to the active
   *  company so the user only sees files for the workspace they're in. */
  companyId?: string;
  brandId?: string;
  format?: 'pdf' | 'png' | 'jpeg';
  dateFrom?: string;
  dateTo?: string;
  sizeLabel?: string;
  batchId?: string;
}

/** Stats for the File Manager's storage panel. Per-format breakdown lets
 *  the user see at a glance "I'm mostly carrying PDF bytes" or similar. */
export interface FileStorageStats {
  totalFiles: number;
  totalBytes: number;
  byFormat: Record<string, { count: number; bytes: number }>;
}

// Whitelist of columns the renderer is allowed to sort by. Anything outside
// this list falls back to created_at. Keeps the SQL safe from injection
// while letting the UI pick any visible column header.
export type FileSortKey =
  | 'created_at'
  | 'sku'
  | 'brand'
  | 'size_label'
  | 'format'
  | 'dpi'
  | 'file_path';

const SORT_COLUMN: Record<FileSortKey, string> = {
  created_at: 'created_at',
  sku: 'sku',
  brand: 'brand_id', // sort by id is stable; UI shows name but that's a JOIN
  size_label: 'size_label',
  format: 'format',
  dpi: 'dpi',
  file_path: 'file_path',
};

export interface FileListOptions {
  filters: FileFilters;
  sortKey?: FileSortKey;
  sortDir?: 'asc' | 'desc';
  /** 0-based page index. */
  page?: number;
  /** Rows per page (capped at 500). */
  pageSize?: number;
}

export interface FileListResult {
  rows: FileEntry[];
  total: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildWhere(filters: FileFilters): {
  sql: string;
  params: Array<string | number>;
} {
  const where: string[] = ['deleted_at IS NULL'];
  const params: Array<string | number> = [];
  if (filters.query) {
    where.push('(sku LIKE ? OR file_path LIKE ?)');
    params.push(`%${filters.query}%`, `%${filters.query}%`);
  }
  if (filters.companyId) {
    where.push('company_id = ?');
    params.push(filters.companyId);
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
  return { sql: where.join(' AND '), params };
}

export const FileService = {
  list(filters: FileFilters, limit = 500): FileEntry[] {
    // Back-compat shim: the old call site (already-shipped 0.2.x DMGs) hits
    // this through the listLegacy IPC. New UI uses listPaged() below.
    return FileService.listPaged({
      filters,
      page: 0,
      pageSize: limit,
    }).rows;
  },

  listPaged(opts: FileListOptions): FileListResult {
    const db = getDb();
    const { sql: whereSql, params } = buildWhere(opts.filters);

    const sortKey: FileSortKey = opts.sortKey ?? 'created_at';
    const sortCol = SORT_COLUMN[sortKey] ?? 'created_at';
    const sortDir = opts.sortDir === 'asc' ? 'ASC' : 'DESC';

    // Total count (filtered, pre-pagination) so the UI can render
    // "showing 1–50 of 1,247".
    const total = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM generations WHERE ${whereSql}`)
        .get(...params) as { c: number }
    ).c;

    const pageSize = Math.min(Math.max(1, opts.pageSize ?? 50), 500);
    const page = Math.max(0, opts.page ?? 0);
    const offset = page * pageSize;

    const sql = `SELECT id, batch_id, sku, brand_id, template_id, format, dpi, size_label, file_path, file_size, created_at
                 FROM generations
                 WHERE ${whereSql}
                 ORDER BY ${sortCol} ${sortDir}, id ${sortDir}
                 LIMIT ${pageSize} OFFSET ${offset}`;

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

    return {
      total,
      rows: rows.map((r) => ({
        ...r,
        brand_name: brandMap.get(r.brand_id)?.name ?? null,
        exists: existsSync(r.file_path),
      })),
    };
  },

  /** Distinct size labels currently in use. Optionally scoped to a company
   *  so the File Manager sidebar only shows sizes that exist for the
   *  currently-active workspace. */
  distinctSizes(companyId?: string): string[] {
    const db = getDb();
    const rows = companyId
      ? (db
          .prepare(
            `SELECT DISTINCT size_label FROM generations
             WHERE deleted_at IS NULL AND company_id = ?
             ORDER BY size_label`,
          )
          .all(companyId) as Array<{ size_label: string }>)
      : (db
          .prepare(
            `SELECT DISTINCT size_label FROM generations
             WHERE deleted_at IS NULL
             ORDER BY size_label`,
          )
          .all() as Array<{ size_label: string }>);
    return rows.map((r) => r.size_label);
  },

  /** Aggregate file count + byte total, optionally scoped to a company.
   *  Used by the storage stats card at the top of the File Manager. */
  storageStats(companyId?: string): FileStorageStats {
    const db = getDb();
    const where: string[] = ['deleted_at IS NULL'];
    const params: string[] = [];
    if (companyId) {
      where.push('company_id = ?');
      params.push(companyId);
    }
    const rows = db
      .prepare(
        `SELECT format,
                COUNT(*)             AS c,
                COALESCE(SUM(file_size), 0) AS b
         FROM generations
         WHERE ${where.join(' AND ')}
         GROUP BY format`,
      )
      .all(...params) as Array<{ format: string; c: number; b: number }>;
    const byFormat: FileStorageStats['byFormat'] = {};
    let totalFiles = 0;
    let totalBytes = 0;
    for (const r of rows) {
      byFormat[r.format] = { count: r.c, bytes: r.b };
      totalFiles += r.c;
      totalBytes += r.b;
    }
    return { totalFiles, totalBytes, byFormat };
  },

  /**
   * Soft-delete: tombstones the row so it disappears from `list()`. The file on
   * disk is left in place so an undo can restore the entry without re-rendering.
   * `purgeDeleted()` (run at app start) is what actually removes the file and
   * the row.
   *
   * `alsoFromDisk` is retained for IPC compatibility — disk removal now always
   * happens at purge time, so the flag has no immediate effect.
   */
  delete(id: string, _alsoFromDisk: boolean): boolean {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, deleted_at FROM generations WHERE id = ?`,
      )
      .get(id) as { id: string; deleted_at: string | null } | undefined;
    if (!row) return false;
    if (row.deleted_at) return true;
    db.prepare(`UPDATE generations SET deleted_at = ? WHERE id = ?`).run(
      nowIso(),
      id,
    );
    return true;
  },

  restore(id: string): boolean {
    const db = getDb();
    const row = db
      .prepare(`SELECT id FROM generations WHERE id = ? AND deleted_at IS NOT NULL`)
      .get(id) as { id: string } | undefined;
    if (!row) return false;
    db.prepare(`UPDATE generations SET deleted_at = NULL WHERE id = ?`).run(id);
    return true;
  },

  /**
   * Hard-delete every tombstoned generation: remove the file from disk (best
   * effort) and drop the row. Called once at app start so undo is scoped to the
   * session that triggered the delete.
   */
  purgeDeleted(): number {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, file_path FROM generations WHERE deleted_at IS NOT NULL`,
      )
      .all() as Array<{ id: string; file_path: string }>;
    if (rows.length === 0) return 0;
    const stmt = db.prepare(`DELETE FROM generations WHERE id = ?`);
    const tx = db.transaction((items: typeof rows) => {
      for (const r of items) {
        try {
          if (existsSync(r.file_path)) unlinkSync(r.file_path);
        } catch (err) {
          console.error('Failed to delete file from disk:', err);
        }
        stmt.run(r.id);
      }
    });
    tx(rows);
    return rows.length;
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
         WHERE id = ? AND deleted_at IS NULL`,
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
