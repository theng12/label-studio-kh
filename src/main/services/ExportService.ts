import puppeteer, { type Browser } from 'puppeteer';
import { writeFileSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Template } from '@shared/types/template';
import type { Brand } from '@shared/types/brand';
import { renderStickerHtml } from './StickerRenderer';
import { getDb } from './Database';

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  _browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return _browser;
}

export async function shutdownBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

export type ExportFormat = 'pdf' | 'png' | 'jpeg';

export interface ExportSettings {
  formats: ExportFormat[];
  dpi: 150 | 300 | 600;
  outputDir: string;
  filenamePattern: string; // tokens: {SKU} {Brand} {Size} {Date} {Name} {Index}
  folderOrganization: 'none' | 'brand' | 'brand_size' | 'brand_template';
  overwrite: boolean;
}

export interface SingleExportInput {
  template: Template;
  brand: Brand | null;
  row: Record<string, string>;
  index: number;
  total: number;
  settings: ExportSettings;
  batchId: string;
}

export interface ExportResult {
  files: string[];
  errors: string[];
}

const SAFE_CHARS = /[^a-zA-Z0-9_.\- ]+/g;

function sanitize(s: string, maxLen = 80): string {
  return s.replace(SAFE_CHARS, '').replace(/\s+/g, '_').slice(0, maxLen) || 'unnamed';
}

function resolveFilename(
  pattern: string,
  ctx: {
    sku: string;
    brand: string;
    size: string;
    name: string;
    index: number;
    date: string;
  },
): string {
  return pattern
    .replace(/\{SKU\}/g, sanitize(ctx.sku, 40))
    .replace(/\{Brand\}/g, sanitize(ctx.brand, 30))
    .replace(/\{Size\}/g, ctx.size)
    .replace(/\{Date\}/g, ctx.date)
    .replace(/\{Name\}/g, sanitize(ctx.name, 40))
    .replace(/\{Index\}/g, String(ctx.index).padStart(4, '0'));
}

function resolveFolder(
  base: string,
  org: ExportSettings['folderOrganization'],
  ctx: { brand: string; size: string; templateName: string },
): string {
  switch (org) {
    case 'none':
      return base;
    case 'brand':
      return join(base, sanitize(ctx.brand, 40));
    case 'brand_size':
      return join(base, sanitize(ctx.brand, 40), ctx.size);
    case 'brand_template':
      return join(base, sanitize(ctx.brand, 40), sanitize(ctx.templateName, 40));
  }
}

function dpiToScale(dpi: 150 | 300 | 600): number {
  // Puppeteer's deviceScaleFactor: 1 = 96dpi. For PNG/JPEG output we set
  // deviceScaleFactor = dpi/96 to get high-resolution screenshots.
  return dpi / 96;
}

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export async function exportSingle(input: SingleExportInput): Promise<ExportResult> {
  const { template, brand, row, index, settings, batchId } = input;
  const result: ExportResult = { files: [], errors: [] };

  const html = await renderStickerHtml(template, brand, row);

  const sku = String(row['sku'] ?? row['SKU'] ?? `row${index}`).trim() || `row${index}`;
  const productName = String(row['product_name'] ?? row['name'] ?? '').trim();
  const sizeLabel = `${template.width_mm}x${template.height_mm}mm`;
  const date = todayYYYYMMDD();

  const baseFilename = resolveFilename(settings.filenamePattern, {
    sku,
    brand: brand?.name ?? 'unknown',
    size: sizeLabel,
    name: productName || sku,
    index,
    date,
  });

  const folder = resolveFolder(settings.outputDir, settings.folderOrganization, {
    brand: brand?.name ?? 'unknown',
    size: sizeLabel,
    templateName: template.name,
  });

  if (!existsSync(folder)) mkdirSync(folder, { recursive: true });

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: Math.round(template.width_mm * 3.7795275591), // mm → px @ 96dpi
      height: Math.round(template.height_mm * 3.7795275591),
      deviceScaleFactor: dpiToScale(settings.dpi),
    });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    for (const format of settings.formats) {
      const ext = format === 'jpeg' ? 'jpg' : format;
      const filePath = join(folder, `${baseFilename}.${ext}`);

      if (existsSync(filePath) && !settings.overwrite) {
        result.errors.push(`Skipped (already exists): ${filePath}`);
        continue;
      }

      try {
        if (format === 'pdf') {
          const pdfBuf = await page.pdf({
            width: `${template.width_mm}mm`,
            height: `${template.height_mm}mm`,
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            preferCSSPageSize: true,
          });
          writeFileSync(filePath, pdfBuf);
        } else {
          const screenshot = await page.screenshot({
            type: format === 'jpeg' ? 'jpeg' : 'png',
            quality: format === 'jpeg' ? 92 : undefined,
            omitBackground: format === 'png',
            fullPage: false,
            clip: {
              x: 0,
              y: 0,
              width: Math.round(template.width_mm * 3.7795275591),
              height: Math.round(template.height_mm * 3.7795275591),
            },
          });
          writeFileSync(filePath, screenshot);
        }
        result.files.push(filePath);

        // Persist generation record so File Manager can find it later.
        try {
          const stats = statSync(filePath);
          getDb()
            .prepare(
              `INSERT INTO generations (id, batch_id, sku, brand_id, template_id, format, dpi, size_label, file_path, file_size, template_snapshot, data_snapshot, brand_snapshot, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              randomUUID(),
              batchId,
              sku,
              brand?.id ?? '',
              template.id,
              format,
              settings.dpi,
              sizeLabel,
              filePath,
              stats.size,
              JSON.stringify(template),
              JSON.stringify(row),
              brand ? JSON.stringify(brand) : null,
              new Date().toISOString(),
            );
        } catch (e) {
          // DB failure is non-fatal for the export itself.
          console.error('Failed to record generation:', e);
        }
      } catch (err) {
        result.errors.push(`${baseFilename}.${ext}: ${String(err)}`);
      }
    }
  } finally {
    await page.close();
  }

  return result;
}

// Bulk export — orchestrated from outside (so the UI can show progress per item).
// `onProgress` is invoked after each row completes.
export interface BulkExportInput {
  template: Template;
  brand: Brand | null;
  rows: Record<string, string>[];
  settings: ExportSettings;
  onProgress?: (info: { index: number; total: number; sku: string; result: ExportResult }) => void;
  isCancelled?: () => boolean;
}

export interface BulkExportSummary {
  batchId: string;
  total: number;
  generated: number;
  errors: string[];
  outputDir: string;
}

const CONCURRENCY = 4; // 4 pages in flight is a good balance on macOS

export async function exportBulk(input: BulkExportInput): Promise<BulkExportSummary> {
  const { template, brand, rows, settings, onProgress, isCancelled } = input;

  const batchId = randomUUID();
  const summary: BulkExportSummary = {
    batchId,
    total: rows.length,
    generated: 0,
    errors: [],
    outputDir: settings.outputDir,
  };

  if (!existsSync(settings.outputDir)) mkdirSync(settings.outputDir, { recursive: true });

  // Record batch start
  try {
    getDb()
      .prepare(
        `INSERT INTO batches (id, brand_id, template_id, total_count, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(batchId, brand?.id ?? '', template.id, rows.length, new Date().toISOString());
  } catch (e) {
    console.error('Failed to record batch:', e);
  }

  // Process rows in waves of CONCURRENCY.
  let cursor = 0;
  while (cursor < rows.length) {
    if (isCancelled?.()) break;

    const slice = rows.slice(cursor, cursor + CONCURRENCY);
    const results = await Promise.all(
      slice.map((row, i) =>
        exportSingle({
          template,
          brand,
          row,
          index: cursor + i + 1,
          total: rows.length,
          settings,
          batchId,
        }).catch((err) => ({ files: [], errors: [String(err)] }) as ExportResult),
      ),
    );

    for (let i = 0; i < results.length; i += 1) {
      const r = results[i]!;
      summary.generated += r.files.length;
      summary.errors.push(...r.errors);
      const row = slice[i]!;
      onProgress?.({
        index: cursor + i + 1,
        total: rows.length,
        sku: String(row['sku'] ?? `row${cursor + i + 1}`),
        result: r,
      });
    }

    cursor += slice.length;
  }

  // Mark batch complete
  try {
    getDb()
      .prepare(`UPDATE batches SET completed_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), batchId);
  } catch (e) {
    console.error('Failed to mark batch complete:', e);
  }

  return summary;
}
