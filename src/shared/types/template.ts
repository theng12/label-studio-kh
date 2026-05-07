export type ElementType =
  | 'logo'
  | 'barcode'
  | 'qr'
  | 'sku'
  | 'text'
  | 'image'
  | 'colorbar'
  | 'strip'
  | 'cert'
  | 'divider'
  | 'date'
  | 'rect'
  | 'price'
  | 'country';

/**
 * Whether resizing should default to maintaining the current aspect ratio for
 * a given element type. Users can override per-element via the Properties
 * panel, but these defaults match what people expect for each kind of object:
 * logos / QR / cert / image keep their ratio, everything else is freeform.
 */
export function defaultAspectLock(type: ElementType): boolean {
  return type === 'qr' || type === 'logo' || type === 'cert' || type === 'image';
}

export function isAspectLocked(el: BaseElement): boolean {
  return el.aspectLocked ?? defaultAspectLock(el.type);
}

export interface BaseElement {
  id: string;
  type: ElementType;
  name?: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  visible: boolean;
  zIndex: number;
  locked: boolean;
  /**
   * When true, resizing keeps the current width/height ratio. When false,
   * dimensions are independent. When undefined, the per-type default applies
   * (logos / QR / cert / image default to true; everything else to false).
   */
  aspectLocked?: boolean;
}

export interface LogoElement extends BaseElement {
  type: 'logo';
  objectFit: 'contain' | 'cover' | 'fill';
  /**
   * Which of the brand's logos to display. References a Brand.logos[].id.
   * When undefined, the brand's first logo is used.
   */
  logoId?: string;
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  format: 'EAN-13' | 'Code128' | 'Code39' | 'UPC-A';
  dataSource: 'csv_column' | 'manual';
  csvColumn: string;
  manualValue: string;
  showHumanReadable: boolean;
  showPrefix: boolean;
  barColor: string;
}

export interface QRElement extends BaseElement {
  type: 'qr';
  mode: 'static' | 'dynamic_sku' | 'dynamic_csv' | 'custom';
  staticUrl: string;
  dynamicBaseUrl: string;
  csvColumn: string;
  showUrlText: boolean;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}

export type BrandField =
  | 'address'
  | 'phone'
  | 'email'
  | 'website'
  | 'tagline'
  | 'customerCareLabel';

export interface TextElement extends BaseElement {
  type: 'text' | 'sku';
  /**
   * Where the text comes from at render time.
   * - static: the staticText field below
   * - csv_column: a value from the imported product row
   * - brand_field: a field from the active brand (address, phone, etc.)
   */
  dataSource: 'static' | 'csv_column' | 'brand_field';
  staticText: string;
  csvColumn: string;
  /** Which brand field to display when dataSource is 'brand_field'. */
  brandField?: BrandField;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  color: string;
  align: 'left' | 'center' | 'right';
  // When true, the text wraps inside the box. When false (default for older
  // templates), the text stays on one line and overflow is clipped/ellipsised.
  multiline?: boolean;
  // Line height multiplier (e.g. 1.2 = 1.2× the font size). Only used when
  // multiline is true. Defaults to 1.2 if undefined.
  lineHeight?: number;
  // Vertical alignment within the box (multiline only).
  verticalAlign?: 'top' | 'center' | 'bottom';
  maxChars: number | null;
  language: string | null;
}

export interface PriceElement extends BaseElement {
  type: 'price';
  // Regular price source.
  amountSource: 'static' | 'csv_column';
  amountStatic: string;
  amountCsvColumn: string;
  // Optional sale price. When present, it's shown in the prominent position
  // and the regular price is rendered smaller with a strikethrough.
  salePriceSource: 'none' | 'static' | 'csv_column';
  salePriceStatic: string;
  salePriceCsvColumn: string;
  // Currency formatting.
  currency: string; // '$', '€', '£', '¥', '฿', '៛', 'USD', etc.
  currencyPosition: 'before' | 'after';
  thousandsSeparator: ',' | '.' | ' ' | '';
  decimalSeparator: '.' | ',';
  decimals: number;
  // Display.
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  color: string;
  saleColor: string; // colour of the strike-through regular price
  align: 'left' | 'center' | 'right';
}

export interface CountryElement extends BaseElement {
  type: 'country';
  source: 'static' | 'csv_column';
  staticCountry: string; // free-text country name, e.g. "Cambodia"
  csvColumn: string;
  countryCode: string; // ISO 3166-1 alpha-2, e.g. "KH" — used for the flag emoji
  prefix: string; // "Made in", "Origin:", etc.
  showFlag: boolean;
  showName: boolean;
  showCode: boolean;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface DateElement extends BaseElement {
  type: 'date';
  mode: 'blank' | 'today' | 'csv_column' | 'static';
  csvColumn: string;
  staticDate: string;
  format: string;
  labelText: string;
  showDottedLine: boolean;
  fontSize: number;
  fontFamily: string;
  color: string;
}

export interface ColorBarElement extends BaseElement {
  type: 'colorbar';
  color: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'free';
}

export interface StripElement extends BaseElement {
  type: 'strip';
  dataSource: 'static' | 'csv_column';
  staticText: string;
  csvColumn: string;
  unitWord: string;
  unitQtySource: 'static' | 'csv_column';
  unitQtyStatic: number;
  unitQtyCsvColumn: string;
  textAlign: 'left' | 'center' | 'right';
  borderColor: string;
  fillColor: string;
  textColor: string;
  fontSize: number;
}

export interface CertElement extends BaseElement {
  type: 'cert';
  assetPath: string;
  objectFit: 'contain' | 'fill';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  dataSource: 'static_asset' | 'csv_column_path';
  assetPath: string;
  csvColumn: string;
  objectFit: 'contain' | 'cover' | 'fill';
}

export interface DividerElement extends BaseElement {
  type: 'divider';
  orientation: 'horizontal' | 'vertical';
  color: string;
  thickness_mm: number;
}

export interface RectElement extends BaseElement {
  type: 'rect';
  fillColor: string;
  borderColor: string;
  borderWidth_mm: number;
  cornerRadius_mm: number;
}

export type TemplateElement =
  | LogoElement
  | BarcodeElement
  | QRElement
  | TextElement
  | DateElement
  | ColorBarElement
  | StripElement
  | CertElement
  | ImageElement
  | DividerElement
  | RectElement
  | PriceElement
  | CountryElement;

export interface Template {
  id: string;
  brandId: string;
  name: string;
  orientation: 'portrait' | 'landscape';
  width_mm: number;
  height_mm: number;
  background: string;
  elements: TemplateElement[];
  createdAt: string;
  updatedAt: string;
}

export type NewTemplateInput = Omit<Template, 'id' | 'createdAt' | 'updatedAt'>;
