// Formatting helpers shared between the canvas (ElementView) and the export
// engine (StickerRenderer). Keeping them here means the designer preview and
// the printed output always match.

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
