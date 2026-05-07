// Formatting helpers shared between the canvas (ElementView) and the export
// engine (StickerRenderer). Keeping them here means the designer preview and
// the printed output always match.

// Typographic conversions. The spec stores fontSize in points (a physical
// unit). The canvas renders in CSS pixels at a zoom-dependent pxPerMm, so we
// have to convert pt → mm → px to keep text proportionate as the user zooms.
export const MM_PER_PT = 25.4 / 72;
export const CSS_PX_PER_MM = 96 / 25.4; // 1:1 physical at 96 DPI

export function ptToPx(pt: number, pxPerMm = CSS_PX_PER_MM): number {
  return pt * MM_PER_PT * pxPerMm;
}

// ── Barcode helpers ─────────────────────────────────────────────────────────

/**
 * Compute the EAN-13 check digit for a 12-digit base. EAN-13 multiplies
 * digits at odd positions (1-indexed) by 1 and even by 3, sums them, and
 * the check digit is (10 - sum mod 10) mod 10.
 */
export function ean13CheckDigit(twelveDigits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const d = twelveDigits.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Generate a valid 13-digit EAN-13 from any string seed (typically a SKU).
 * Deterministic — the same seed always produces the same barcode — so users
 * can re-import a CSV and get stable codes. The first 3 digits default to
 * "200" (the EAN-13 in-store / private-use range) so the codes don't collide
 * with real GS1-issued ones.
 */
export function generateEan13FromSeed(seed: string, prefix = '200'): string {
  // Cheap 32-bit FNV-1a hash. Plenty of entropy for 9 digits.
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const padPrefix = (prefix + '000').slice(0, 3).replace(/\D/g, '0').padStart(3, '0');
  // Need 9 more digits to reach 12. Combine the hash + a secondary mix.
  const a = String(hash % 1_000_000).padStart(6, '0');
  const b = String((hash >>> 6) % 1000).padStart(3, '0');
  const twelve = `${padPrefix}${a}${b}`;
  return `${twelve}${ean13CheckDigit(twelve)}`;
}

// ── Date formatting ─────────────────────────────────────────────────────────

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Parse a date value from CSV / static input. Accepts either an ISO date,
 * a DD/MM/YYYY string, or anything Date can parse. Falls back to today on
 * an invalid input.
 */
export function parseDateLoose(s: string | Date): Date {
  if (s instanceof Date) return s;
  const trimmed = (s ?? '').trim();
  if (!trimmed) return new Date(NaN);
  // ISO yyyy-mm-dd
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  // DD/MM/YYYY (most common in the spec)
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  // Fall back to native parsing
  const d = new Date(trimmed);
  return d;
}

export type DateFormatStyle = 'short' | 'long' | 'iso' | 'custom';

export function formatDate(
  d: Date,
  style: DateFormatStyle,
  customFormat = 'DD/MM/YYYY',
): string {
  if (!Number.isFinite(d.getTime())) return '';
  const Y = d.getFullYear();
  const M = d.getMonth() + 1;
  const D = d.getDate();
  switch (style) {
    case 'iso':
      return `${Y}-${pad2(M)}-${pad2(D)}`;
    case 'long':
      return `${D} ${MONTHS_LONG[d.getMonth()]} ${Y}`;
    case 'short':
      return `${pad2(D)}/${pad2(M)}/${Y}`;
    case 'custom':
      return customFormat
        .replace(/YYYY/g, String(Y))
        .replace(/MM/g, pad2(M))
        .replace(/DD/g, pad2(D));
  }
}



export function flagFromCode(code: string): string {
  const c = (code || '').trim().toUpperCase();
  if (c.length !== 2) return '';
  const A = 0x1f1e6;
  const a = c.charCodeAt(0);
  const b = c.charCodeAt(1);
  if (a < 65 || a > 90 || b < 65 || b > 90) return '';
  return String.fromCodePoint(A + (a - 65), A + (b - 65));
}

export interface PriceFormat {
  currency: string;
  currencyPosition: 'before' | 'after';
  thousandsSeparator: ',' | '.' | ' ' | '';
  decimalSeparator: '.' | ',';
  decimals: number;
}

export function formatPrice(input: string | number, fmt: PriceFormat): string {
  if (input === '' || input === null || input === undefined) return '';
  // Accept things like "9.99", "9,99", "$9.99", "1,234.56" and pull the number out.
  const cleaned = String(input).replace(/[^0-9.,\-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return String(input);

  const fixed = Math.abs(num).toFixed(fmt.decimals);
  const [intPart, decPart] = fixed.split('.');
  const withSep = (intPart ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, fmt.thousandsSeparator);
  const number = decPart && fmt.decimals > 0
    ? `${withSep}${fmt.decimalSeparator}${decPart}`
    : withSep;
  const signed = num < 0 ? `-${number}` : number;

  return fmt.currencyPosition === 'before'
    ? `${fmt.currency}${signed}`
    : `${signed}${fmt.currency}`;
}
