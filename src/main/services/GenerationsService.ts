// Historical generation-batch queries. The export pipeline (ExportService)
// writes one row per produced file to the `generations` table tagged with a
// shared `batch_id`. This service groups those rows back into batches for
// the Jobs/History page — "you ran 234 labels of Brand X on this template
// last Tuesday" — without making the renderer issue per-row queries.
//
// Lives separate from FileService because FileService is per-file (with its
// own filters / pagination); a batch is an aggregation across files.

import { getDb } from './Database';
import { BrandService } from './BrandService';

export interface BatchSummary {
  batchId: string;
  brandId: string;
  brandName: string | null;
  templateId: string;
  companyId: string | null;
  /** Distinct size labels in the batch (usually 1, but a multi-template
   *  batch could mix; we keep them de-duped for display). */
  sizeLabels: string[];
  /** Distinct file formats in the batch (pdf, png, jpeg). */
  formats: string[];
  fileCount: number;
  skuCount: number;
  /** ISO timestamp of the earliest row — when the batch started. */
  startedAt: string;
  /** ISO timestamp of the latest row — when the last file landed. */
  finishedAt: string;
  /** Total on-disk size summed across all files in the batch (bytes).
   *  Can be null if every row was written before file_size tracking landed. */
  totalBytes: number | null;
}

export const GenerationsService = {
  /** Return recent batches, newest first. Optional company scope mirrors the
   *  rest of the app (active-company filter). `limit` caps the result for
   *  the Jobs page; passing 0/undefined defaults to 100. */
  listBatches(companyId?: string, limit = 100): BatchSummary[] {
    const db = getDb();

    // Build the WHERE clause dynamically so the company filter is optional.
    const params: unknown[] = [];
    let where = 'deleted_at IS NULL AND batch_id IS NOT NULL';
    if (companyId) {
      where += ' AND company_id = ?';
      params.push(companyId);
    }

    // GROUP_CONCAT(DISTINCT …) gives us the per-batch set of formats/sizes
    // in one round-trip; we split client-side. Sort by latest finished_at
    // so a batch that was running at the cutoff bubbles up.
    const sql = `
      SELECT batch_id                                        AS batchId,
             MAX(brand_id)                                   AS brandId,
             MAX(template_id)                                AS templateId,
             MAX(company_id)                                 AS companyId,
             GROUP_CONCAT(DISTINCT size_label)               AS sizeLabelsCsv,
             GROUP_CONCAT(DISTINCT format)                   AS formatsCsv,
             COUNT(*)                                        AS fileCount,
             COUNT(DISTINCT sku)                             AS skuCount,
             MIN(created_at)                                 AS startedAt,
             MAX(created_at)                                 AS finishedAt,
             SUM(file_size)                                  AS totalBytes
      FROM generations
      WHERE ${where}
      GROUP BY batch_id
      ORDER BY finishedAt DESC
      LIMIT ?
    `;
    params.push(limit > 0 ? limit : 100);

    const rows = db.prepare(sql).all(...params) as Array<{
      batchId: string;
      brandId: string;
      templateId: string;
      companyId: string | null;
      sizeLabelsCsv: string | null;
      formatsCsv: string | null;
      fileCount: number;
      skuCount: number;
      startedAt: string;
      finishedAt: string;
      totalBytes: number | null;
    }>;

    const brands = BrandService.list();
    const brandMap = new Map(brands.map((b) => [b.id, b]));

    return rows.map((r) => ({
      batchId: r.batchId,
      brandId: r.brandId,
      brandName: brandMap.get(r.brandId)?.name ?? null,
      templateId: r.templateId,
      companyId: r.companyId,
      sizeLabels: r.sizeLabelsCsv ? r.sizeLabelsCsv.split(',') : [],
      formats: r.formatsCsv ? r.formatsCsv.split(',') : [],
      fileCount: r.fileCount,
      skuCount: r.skuCount,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      totalBytes: r.totalBytes,
    }));
  },
};
