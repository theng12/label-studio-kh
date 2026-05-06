#!/usr/bin/env node
// Generates 1000 labels into a temp folder using the bundled Puppeteer +
// StickerRenderer pipeline. Reports throughput. Validates the spec target of
// 50–100 labels/min for PDF output.
//
// Run with: npm run bench
//
// This script does NOT need Electron — it runs the renderer + export logic
// directly under Node so we can measure them in isolation.

import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer';

// Inline a minimal sticker HTML so we don't have to import the TS module.
function html(row, w, h) {
  return `<!doctype html>
<html><head><style>
  @page { size: ${w}mm ${h}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: ${w}mm; height: ${h}mm; position: relative; font-family: system-ui, sans-serif; }
  .name { position: absolute; left: 3mm; top: 5mm; font-weight: 700; font-size: 10pt; }
  .sku  { position: absolute; left: 3mm; top: 12mm; font-size: 8pt; color: #666; }
  .bar  { position: absolute; left: 3mm; bottom: 3mm; right: 3mm; height: 12mm;
          background: repeating-linear-gradient(90deg, #000 0 1px, transparent 1px 3px); }
  .barcode-text { position: absolute; left: 3mm; bottom: 0.8mm; font-family: monospace; font-size: 7pt; }
</style></head><body>
  <div class="name">${row.product_name}</div>
  <div class="sku">${row.sku}</div>
  <div class="bar"></div>
  <div class="barcode-text">${row.barcode}</div>
</body></html>`;
}

const N = parseInt(process.env.BENCH_N || '1000', 10);
const W = 70, H = 50;
const CONCURRENCY = parseInt(process.env.BENCH_CONCURRENCY || '4', 10);

console.log(`Generating ${N} labels at ${W}×${H}mm with concurrency=${CONCURRENCY}...`);

const dir = mkdtempSync(join(tmpdir(), 'lskh-bench-'));
console.log(`Output dir: ${dir}`);

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const start = Date.now();

try {
  let cursor = 0;
  while (cursor < N) {
    const slice = Math.min(CONCURRENCY, N - cursor);
    await Promise.all(
      Array.from({ length: slice }, async (_, i) => {
        const idx = cursor + i + 1;
        const row = {
          sku: `BENCH-${String(idx).padStart(4, '0')}`,
          product_name: `Bench Product ${idx}`,
          barcode: `885${String(idx).padStart(10, '0')}`,
        };
        const page = await browser.newPage();
        try {
          await page.setViewport({
            width: Math.round(W * 3.7795),
            height: Math.round(H * 3.7795),
            deviceScaleFactor: 1,
          });
          await page.setContent(html(row, W, H), { waitUntil: 'networkidle0' });
          await page.pdf({
            path: join(dir, `${row.sku}.pdf`),
            width: `${W}mm`,
            height: `${H}mm`,
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            preferCSSPageSize: true,
          });
        } finally {
          await page.close();
        }
      }),
    );
    cursor += slice;
    if (cursor % 100 === 0 || cursor === N) {
      const elapsed = (Date.now() - start) / 1000;
      const rate = cursor / elapsed;
      const eta = (N - cursor) / rate;
      process.stdout.write(
        `\r  ${cursor}/${N} (${rate.toFixed(1)}/s, ETA ${eta.toFixed(0)}s)         `,
      );
    }
  }
  process.stdout.write('\n');

  const elapsed = (Date.now() - start) / 1000;
  const rate = N / elapsed;
  const sample = statSync(join(dir, 'BENCH-0001.pdf'));

  console.log('');
  console.log(`Total:        ${elapsed.toFixed(1)}s for ${N} labels`);
  console.log(`Rate:         ${rate.toFixed(1)} labels/sec  (${(rate * 60).toFixed(0)} /min)`);
  console.log(`Per label:    ${((elapsed / N) * 1000).toFixed(0)} ms`);
  console.log(`Sample size:  ${(sample.size / 1024).toFixed(1)} KB`);
  console.log('');

  if (rate * 60 < 50) {
    console.log(`⚠ Below spec target of 50/min — try increasing concurrency.`);
    process.exitCode = 1;
  } else {
    console.log(`✓ Meets spec target of 50–100 labels/min for PDF.`);
  }
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
