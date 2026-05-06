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
  | 'rect';

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
}

export interface LogoElement extends BaseElement {
  type: 'logo';
  objectFit: 'contain' | 'cover' | 'fill';
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

export interface TextElement extends BaseElement {
  type: 'text' | 'sku';
  dataSource: 'static' | 'csv_column';
  staticText: string;
  csvColumn: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  color: string;
  align: 'left' | 'center' | 'right';
  maxChars: number | null;
  language: string | null;
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
  | RectElement;

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
