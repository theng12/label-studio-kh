import JsBarcode from 'jsbarcode';
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';
import { generateEan13FromSeed } from '@shared/format';

export type BarcodeFormat = 'EAN-13' | 'Code128' | 'Code39' | 'UPC-A';
export type BarcodeOutput = 'svg' | 'png';

export interface BarcodeBatchInput {
  values: string[];
  format: BarcodeFormat;
  output: BarcodeOutput;
  outputDir: string;
  width_mm: number;
  height_mm: number;
  showText: boolean;
  /** Filename = "<prefix><value>.<ext>". Prefix may be empty. */
  filenamePrefix: string;
  dpi: 150 | 300 | 600;
  /**
   * If true and a value is empty, generate a deterministic EAN-13 from the
   * provided seed (the index, in this batch context). Used by the "sequence"
   * input mode where the user just wants N consecutive codes.
   */
  fillEmpty: boolean;
}

export interface BarcodeBatchSummary {
  generated: number;
  files: string[];
  errors: string[];
}

const SAFE_CHARS = /[^a-zA-Z0-9_.\- ]+/g;
function sanitize(s: string): string {
  return s.replace(SAFE_CHARS, '').replace(/\s+/g, '_').slice(0, 80) || 'barcode';
}

// ── SVG generation (sync) ────────────────────────────────────────────────────

export function generateSvg(value: string, format: BarcodeFormat, showText: boolean): string {
  const dom = new DOMImplementation().createDocument(
    'http://www.w3.org/2000/svg',
    'svg',
    null,
  );
  const svgNode = dom.documentElement;
  if (!svgNode) {
    throw new Error('Failed to create SVG document');
  }
  try {
    JsBarcode(svgNode as unknown as SVGSVGElement, value, {
      format,
      displayValue: showText,
      lineColor: '#000000',
      background: '#FFFFFF',
      width: 2,
      height: 60,
      margin: 8,
      fontSize: 14,
      // @ts-expect-error xmlDocument is supported in node mode but missing from types
      xmlDocument: dom,
    });
  } catch (err) {
    throw new Error(`Could not encode "${value}" as ${format}: ${(err as Error).message}`);
  }
  return new XMLSerializer().serializeToString(svgNode);
}

// ── PNG generation (Puppeteer-backed) ───────────────────────────────────────

let _browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  _browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return _browser;
}

export async function shutdownBarcodeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

async function svgToPng(
  svg: string,
  width_mm: number,
  height_mm: number,
  dpi: number,
): Promise<Buffer> {
  const widthPx = Math.round((width_mm * dpi) / 25.4);
  const heightPx = Math.round((height_mm * dpi) / 25.4);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: widthPx, height: heightPx, deviceScaleFactor: 1 });
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;background:#fff}
      svg{width:100%;height:100%;display:block}
    </style></head><body>${svg.replace(
      '<svg ',
      '<svg preserveAspectRatio="xMidYMid meet" ',
    )}</body></html>`;
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return Buffer.from(
      await page.screenshot({
        type: 'png',
        omitBackground: false,
        clip: { x: 0, y: 0, width: widthPx, height: heightPx },
      }),
    );
  } finally {
    await page.close();
  }
}

// ── Batch (delegates to a renderer-side caller for progress) ────────────────

export const BarcodeService = {
  async generateBatch(
    input: BarcodeBatchInput,
    onProgress?: (info: { index: number; total: number; value: string }) => void,
    isCancelled?: () => boolean,
  ): Promise<BarcodeBatchSummary> {
    const summary: BarcodeBatchSummary = { generated: 0, files: [], errors: [] };
    if (!existsSync(input.outputDir)) {
      mkdirSync(input.outputDir, { recursive: true });
    }

    for (let i = 0; i < input.values.length; i += 1) {
      if (isCancelled?.()) break;
      let value = input.values[i]!.trim();
      if (!value && input.fillEmpty) {
        value = generateEan13FromSeed(`barcode-${i}`);
      }
      if (!value) {
        summary.errors.push(`Row ${i + 1}: empty value`);
        onProgress?.({ index: i + 1, total: input.values.length, value: '' });
        continue;
      }

      try {
        const svg = generateSvg(value, input.format, input.showText);
        const ext = input.output === 'png' ? 'png' : 'svg';
        const filename = `${input.filenamePrefix}${sanitize(value)}.${ext}`;
        const dest = join(input.outputDir, filename);
        if (input.output === 'svg') {
          writeFileSync(dest, svg, 'utf8');
        } else {
          const png = await svgToPng(svg, input.width_mm, input.height_mm, input.dpi);
          writeFileSync(dest, png);
        }
        summary.generated += 1;
        summary.files.push(dest);
      } catch (err) {
        summary.errors.push(`${value}: ${(err as Error).message}`);
      }
      onProgress?.({ index: i + 1, total: input.values.length, value });
    }
    return summary;
  },
};
