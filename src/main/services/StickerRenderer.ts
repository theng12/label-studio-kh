import JsBarcode from 'jsbarcode';
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import QRCode from 'qrcode';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { Template, TemplateElement } from '@shared/types/template';
import type { Brand } from '@shared/types/brand';
import { flagFromCode, formatPrice } from '@shared/format';

// Font loading: each entry maps a CSS family name → file under resources/fonts/.
// Missing files are silently skipped (font-display: swap → system fallback).
const FONT_DEFS: Array<{ family: string; weight: 400 | 700; file: string }> = [
  { family: 'NotoSans', weight: 400, file: 'NotoSans-Regular.ttf' },
  { family: 'NotoSans', weight: 700, file: 'NotoSans-Bold.ttf' },
  { family: 'NotoSansKhmer', weight: 400, file: 'NotoSansKhmer-Regular.ttf' },
  { family: 'NotoSansKhmer', weight: 700, file: 'NotoSansKhmer-Bold.ttf' },
  { family: 'NotoSansThai', weight: 400, file: 'NotoSansThai-Regular.ttf' },
  { family: 'NotoSansThai', weight: 700, file: 'NotoSansThai-Bold.ttf' },
  { family: 'NotoSansKR', weight: 400, file: 'NotoSansKR-Regular.otf' },
  { family: 'NotoSansKR', weight: 700, file: 'NotoSansKR-Bold.otf' },
  { family: 'NotoSansSC', weight: 400, file: 'NotoSansSC-Regular.otf' },
  { family: 'NotoSansSC', weight: 700, file: 'NotoSansSC-Bold.otf' },
  { family: 'NotoSansJP', weight: 400, file: 'NotoSansJP-Regular.otf' },
  { family: 'NotoSansJP', weight: 700, file: 'NotoSansJP-Bold.otf' },
];

function fontFaceCss(): string {
  // Resolve fonts dir at runtime: in dev, resources/fonts is at the project root.
  // In production it'll be inside the asar resources.
  const root = app.isPackaged
    ? join(process.resourcesPath, 'fonts')
    : join(process.cwd(), 'resources', 'fonts');

  const blocks: string[] = [];
  for (const def of FONT_DEFS) {
    const path = join(root, def.file);
    if (!existsSync(path)) continue;
    const format = def.file.endsWith('.otf') ? 'opentype' : 'truetype';
    blocks.push(
      `@font-face{font-family:'${def.family}';font-weight:${def.weight};` +
        `font-style:normal;font-display:swap;src:url('file://${path}') format('${format}');}`,
    );
  }
  return blocks.join('\n');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveTextValue(
  el: Extract<TemplateElement, { type: 'text' | 'sku' }>,
  row: Record<string, string>,
): string {
  if (el.dataSource === 'csv_column') {
    return String(row[el.csvColumn] ?? '');
  }
  return el.staticText;
}

function truncate(s: string, max: number | null | undefined): string {
  if (!max || s.length <= max) return s;
  // Try word boundary
  const slice = s.slice(0, max - 1);
  const space = slice.lastIndexOf(' ');
  if (space > Math.floor(max * 0.6)) return slice.slice(0, space) + '…';
  return slice + '…';
}

function formatDate(format: string, d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return format
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()));
}

function resolveDate(
  el: Extract<TemplateElement, { type: 'date' }>,
  row: Record<string, string>,
): string {
  if (el.mode === 'today') return formatDate(el.format, new Date());
  if (el.mode === 'static') return el.staticDate;
  if (el.mode === 'csv_column') return String(row[el.csvColumn] ?? '');
  return ''; // blank
}

function resolveQrUrl(
  el: Extract<TemplateElement, { type: 'qr' }>,
  row: Record<string, string>,
): string {
  switch (el.mode) {
    case 'static':
      return el.staticUrl;
    case 'dynamic_sku':
      return el.dynamicBaseUrl + (row['sku'] ?? '');
    case 'dynamic_csv':
    case 'custom':
      return String(row[el.csvColumn] ?? '');
  }
}

function resolveBarcodeValue(
  el: Extract<TemplateElement, { type: 'barcode' }>,
  row: Record<string, string>,
): string {
  if (el.dataSource === 'csv_column') {
    return String(row[el.csvColumn] ?? '');
  }
  return el.manualValue;
}

// ── Barcode SVG via JsBarcode + xmldom ──────────────────────────────────────

function generateBarcodeSvg(value: string, format: string, color: string): string {
  if (!value) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30"><rect width="100" height="30" fill="#fff"/><text x="50" y="20" text-anchor="middle" font-size="8" fill="#aaa">no barcode</text></svg>`;
  }

  const dom = new DOMImplementation().createDocument(
    'http://www.w3.org/2000/svg',
    'svg',
    null,
  );
  const svgNode = dom.documentElement;
  if (!svgNode) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30"><rect width="100" height="30" fill="#fee"/></svg>`;
  }

  try {
    // JsBarcode supports an undocumented `xmlDocument` option for non-browser environments.
    JsBarcode(svgNode as unknown as SVGSVGElement, value, {
      format,
      displayValue: true,
      lineColor: color,
      background: '#FFFFFF',
      width: 2,
      height: 60,
      margin: 2,
      fontSize: 14,
      // @ts-expect-error - xmlDocument is supported in node mode but missing from types
      xmlDocument: dom,
    });
    return new XMLSerializer().serializeToString(svgNode);
  } catch (err) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30"><rect width="100" height="30" fill="#fee"/><text x="50" y="20" text-anchor="middle" font-size="6" fill="#c00">invalid: ${escapeHtml(String(err))}</text></svg>`;
  }
}

// ── QR SVG via qrcode ────────────────────────────────────────────────────────

async function generateQrSvg(value: string, errorCorrection: 'L' | 'M' | 'Q' | 'H'): Promise<string> {
  if (!value) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff" stroke="#ddd"/></svg>`;
  }
  return await QRCode.toString(value, {
    type: 'svg',
    errorCorrectionLevel: errorCorrection,
    margin: 0,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

// ── Element rendering ────────────────────────────────────────────────────────

interface RenderContext {
  template: Template;
  brand: Brand | null;
  row: Record<string, string>;
}

function styleForElement(el: TemplateElement): string {
  return [
    `position:absolute`,
    `left:${el.x_mm}mm`,
    `top:${el.y_mm}mm`,
    `width:${el.width_mm}mm`,
    `height:${el.height_mm}mm`,
    `z-index:${el.zIndex}`,
    `box-sizing:border-box`,
    `overflow:hidden`,
  ].join(';');
}

async function renderElement(
  el: TemplateElement,
  ctx: RenderContext,
): Promise<string> {
  if (!el.visible) return '';

  const styleAttr = styleForElement(el);

  switch (el.type) {
    case 'logo': {
      // Resolve which of the brand's logos this element wants. Falls back to
      // the brand's first logo, then to the legacy single logoPath, then to a
      // placeholder block so missing-logo doesn't kill the whole render.
      const logos = ctx.brand?.logos ?? [];
      const byId = el.logoId ? logos.find((l) => l.id === el.logoId) : null;
      const path = byId?.path ?? logos[0]?.path ?? ctx.brand?.logoPath ?? '';
      if (!path) {
        return `<div style="${styleAttr};display:flex;align-items:center;justify-content:center;background:#f6f6f6;color:#999;font-size:8pt;">LOGO</div>`;
      }
      return `<div style="${styleAttr}"><img src="file://${path}" style="width:100%;height:100%;object-fit:${el.objectFit};" /></div>`;
    }

    case 'barcode': {
      const value = resolveBarcodeValue(el, ctx.row);
      const svg = generateBarcodeSvg(value, el.format, el.barColor);
      return `<div style="${styleAttr}">${svg.replace('<svg ', '<svg preserveAspectRatio="none" style="width:100%;height:100%" ')}</div>`;
    }

    case 'qr': {
      const url = resolveQrUrl(el, ctx.row);
      const svg = await generateQrSvg(url, el.errorCorrection);
      const inner = svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%" ');
      const text = el.showUrlText
        ? `<div style="font-size:5pt;text-align:center;line-height:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(url)}</div>`
        : '';
      return `<div style="${styleAttr};display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="flex:1;width:100%;">${inner}</div>${text}</div>`;
    }

    case 'text':
    case 'sku': {
      const raw = resolveTextValue(el, ctx.row);
      const text = truncate(raw, el.maxChars);
      const justify =
        el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start';
      const multiline = el.type === 'text' && el.multiline === true;
      const verticalAlign = el.verticalAlign ?? 'top';
      const alignItems = multiline
        ? verticalAlign === 'center'
          ? 'center'
          : verticalAlign === 'bottom'
            ? 'flex-end'
            : 'flex-start'
        : 'center';
      const whiteSpace = multiline ? 'normal' : 'nowrap';
      const lineHeight = multiline ? (el.lineHeight ?? 1.2) : 1.1;
      const wordBreak = multiline ? 'break-word' : 'normal';
      return `<div style="${styleAttr};display:flex;align-items:${alignItems};justify-content:${justify};color:${el.color};font-size:${el.fontSize}pt;font-family:'${el.fontFamily}', sans-serif;font-weight:${el.fontWeight};text-align:${el.align};line-height:${lineHeight};white-space:${whiteSpace};word-break:${wordBreak};">${escapeHtml(text)}</div>`;
    }

    case 'price': {
      const fmt = {
        currency: el.currency,
        currencyPosition: el.currencyPosition,
        thousandsSeparator: el.thousandsSeparator,
        decimalSeparator: el.decimalSeparator,
        decimals: el.decimals,
      };
      const regularRaw =
        el.amountSource === 'csv_column'
          ? String(ctx.row[el.amountCsvColumn] ?? '')
          : el.amountStatic;
      const saleRaw =
        el.salePriceSource === 'none'
          ? ''
          : el.salePriceSource === 'csv_column'
            ? String(ctx.row[el.salePriceCsvColumn] ?? '')
            : el.salePriceStatic;
      const hasSale = el.salePriceSource !== 'none' && saleRaw.trim().length > 0;
      const main = formatPrice(hasSale ? saleRaw : regularRaw, fmt);
      const strike = hasSale ? formatPrice(regularRaw, fmt) : '';
      const justify =
        el.align === 'center'
          ? 'center'
          : el.align === 'right'
            ? 'flex-end'
            : 'flex-start';
      const strikeHtml = strike
        ? `<span style="color:${el.saleColor};font-size:${el.fontSize * 0.65}pt;text-decoration:line-through;font-weight:normal;">${escapeHtml(strike)}</span>`
        : '';
      const mainHtml = `<span style="font-size:${el.fontSize}pt;">${escapeHtml(main)}</span>`;
      return `<div style="${styleAttr};display:flex;align-items:baseline;justify-content:${justify};gap:0.4em;color:${el.color};font-family:'${el.fontFamily}', sans-serif;font-weight:${el.fontWeight};">${strikeHtml}${mainHtml}</div>`;
    }

    case 'country': {
      const name =
        el.source === 'csv_column'
          ? String(ctx.row[el.csvColumn] ?? '')
          : el.staticCountry;
      const flag = el.showFlag ? flagFromCode(el.countryCode) : '';
      const code = el.showCode ? el.countryCode.toUpperCase() : '';
      const parts: string[] = [];
      if (el.prefix) parts.push(escapeHtml(el.prefix));
      if (flag) parts.push(flag);
      if (el.showName && name) parts.push(escapeHtml(name));
      if (code) parts.push(escapeHtml(code));
      const justify =
        el.align === 'center'
          ? 'center'
          : el.align === 'right'
            ? 'flex-end'
            : 'flex-start';
      return `<div style="${styleAttr};display:flex;align-items:center;justify-content:${justify};gap:0.3em;color:${el.color};font-size:${el.fontSize}pt;font-family:'${el.fontFamily}', sans-serif;white-space:nowrap;">${parts.join(' ')}</div>`;
    }

    case 'image': {
      let path = '';
      if (el.dataSource === 'csv_column_path') {
        path = String(ctx.row[el.csvColumn] ?? '') || el.assetPath;
      } else {
        path = el.assetPath;
      }
      if (!path) {
        return `<div style="${styleAttr};display:flex;align-items:center;justify-content:center;background:#f8f8f8;color:#aaa;font-size:7pt;">IMG</div>`;
      }
      const src = path.startsWith('/') ? `file://${path}` : path;
      return `<div style="${styleAttr}"><img src="${src}" style="width:100%;height:100%;object-fit:${el.objectFit};" /></div>`;
    }

    case 'colorbar': {
      return `<div style="${styleAttr};background:${el.color}"></div>`;
    }

    case 'strip': {
      const text =
        el.dataSource === 'csv_column'
          ? String(ctx.row[el.csvColumn] ?? '')
          : el.staticText.replace(/\{(\w+)\}/g, (_, k) =>
              String(ctx.row[k] ?? `{${k}}`),
            );
      const justify =
        el.textAlign === 'center'
          ? 'center'
          : el.textAlign === 'right'
            ? 'flex-end'
            : 'flex-start';
      return `<div style="${styleAttr};display:flex;align-items:center;justify-content:${justify};border:0.3mm solid ${el.borderColor};background:${el.fillColor};color:${el.textColor};font-size:${el.fontSize}pt;padding:0 1mm;">${escapeHtml(text)}</div>`;
    }

    case 'cert': {
      if (!el.assetPath) {
        return `<div style="${styleAttr};display:flex;align-items:center;justify-content:center;background:#fafafa;color:#aaa;font-size:6pt;">CERT</div>`;
      }
      return `<div style="${styleAttr}"><img src="file://${el.assetPath}" style="width:100%;height:100%;object-fit:${el.objectFit};" /></div>`;
    }

    case 'divider': {
      return `<div style="${styleAttr};background:${el.color};"></div>`;
    }

    case 'date': {
      const value = resolveDate(el, ctx.row);
      const label = el.labelText ? `<span>${escapeHtml(el.labelText)}</span>` : '';
      const body = el.showDottedLine
        ? `<span style="flex:1;border-bottom:1px dotted #888;height:50%;"></span>`
        : `<span>${escapeHtml(value)}</span>`;
      return `<div style="${styleAttr};display:flex;align-items:center;gap:1mm;color:${el.color};font-size:${el.fontSize}pt;font-family:'${el.fontFamily}', sans-serif;">${label}${body}</div>`;
    }

    case 'rect': {
      return `<div style="${styleAttr};background:${el.fillColor};border:${el.borderWidth_mm}mm solid ${el.borderColor};border-radius:${el.cornerRadius_mm}mm;"></div>`;
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function renderStickerHtml(
  template: Template,
  brand: Brand | null,
  row: Record<string, string>,
): Promise<string> {
  const ctx: RenderContext = { template, brand, row };
  const elements = await Promise.all(template.elements.map((el) => renderElement(el, ctx)));

  const w = template.width_mm;
  const h = template.height_mm;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${fontFaceCss()}
  @page { size: ${w}mm ${h}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: ${template.background}; }
  body {
    width: ${w}mm; height: ${h}mm; position: relative; overflow: hidden;
    font-family: 'NotoSans', 'NotoSansKhmer', 'NotoSansThai', 'NotoSansKR',
                 'NotoSansSC', 'NotoSansJP', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
</style>
</head>
<body>
${elements.join('\n')}
</body>
</html>`;
}
