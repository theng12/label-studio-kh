import type {
  ElementType,
  TemplateElement,
  BarcodeElement,
  QRElement,
  TextElement,
  DateElement,
  ColorBarElement,
  StripElement,
  CertElement,
  ImageElement,
  DividerElement,
  RectElement,
  LogoElement,
  PriceElement,
  CountryElement,
} from '../../shared/types/template';

const base = {
  id: '',
  x_mm: 0,
  y_mm: 0,
  visible: true,
  zIndex: 0,
  locked: false,
};

export function defaultElement(type: ElementType): TemplateElement {
  switch (type) {
    case 'logo':
      return {
        ...base,
        type: 'logo',
        width_mm: 20,
        height_mm: 20,
        objectFit: 'contain',
        name: 'Logo',
      } satisfies LogoElement;

    case 'barcode':
      return {
        ...base,
        type: 'barcode',
        width_mm: 30,
        height_mm: 12,
        format: 'EAN-13',
        dataSource: 'csv_column',
        csvColumn: 'barcode',
        manualValue: '',
        showHumanReadable: true,
        showPrefix: true,
        barColor: '#000000',
        name: 'Barcode',
      } satisfies BarcodeElement;

    case 'qr':
      return {
        ...base,
        type: 'qr',
        width_mm: 15,
        height_mm: 15,
        mode: 'static',
        staticUrl: 'https://example.com',
        dynamicBaseUrl: '',
        csvColumn: 'product_url',
        showUrlText: false,
        errorCorrection: 'M',
        name: 'QR code',
      } satisfies QRElement;

    case 'sku':
      return {
        ...base,
        type: 'sku',
        width_mm: 30,
        height_mm: 6,
        dataSource: 'csv_column',
        staticText: '',
        csvColumn: 'sku',
        fontSize: 12,
        fontFamily: 'NotoSans',
        fontWeight: 'bold',
        color: '#000000',
        align: 'left',
        maxChars: null,
        language: null,
        name: 'SKU',
      } satisfies TextElement;

    case 'text':
      return {
        ...base,
        type: 'text',
        width_mm: 30,
        height_mm: 6,
        dataSource: 'static',
        staticText: 'Text',
        csvColumn: '',
        fontSize: 10,
        fontFamily: 'NotoSans',
        fontWeight: 'normal',
        color: '#000000',
        align: 'left',
        multiline: false,
        lineHeight: 1.2,
        verticalAlign: 'top',
        maxChars: null,
        language: null,
        name: 'Text',
      } satisfies TextElement;

    case 'image':
      return {
        ...base,
        type: 'image',
        width_mm: 25,
        height_mm: 25,
        dataSource: 'csv_column_path',
        assetPath: '',
        csvColumn: 'product_image_path',
        objectFit: 'contain',
        name: 'Image',
      } satisfies ImageElement;

    case 'colorbar':
      return {
        ...base,
        type: 'colorbar',
        width_mm: 50,
        height_mm: 4,
        color: '#1063E8',
        position: 'free',
        name: 'Color bar',
      } satisfies ColorBarElement;

    case 'strip':
      return {
        ...base,
        type: 'strip',
        width_mm: 50,
        height_mm: 7,
        dataSource: 'static',
        staticText: '1 UNIT OF {product_name}',
        csvColumn: '',
        unitWord: 'UNIT',
        unitQtySource: 'static',
        unitQtyStatic: 1,
        unitQtyCsvColumn: 'unit_qty',
        textAlign: 'center',
        borderColor: '#000000',
        fillColor: '#FFFFFF',
        textColor: '#000000',
        fontSize: 9,
        name: 'Strip',
      } satisfies StripElement;

    case 'cert':
      return {
        ...base,
        type: 'cert',
        width_mm: 12,
        height_mm: 12,
        assetPath: '',
        objectFit: 'contain',
        name: 'Cert badge',
      } satisfies CertElement;

    case 'divider':
      return {
        ...base,
        type: 'divider',
        width_mm: 30,
        height_mm: 0.5,
        orientation: 'horizontal',
        color: '#000000',
        thickness_mm: 0.3,
        name: 'Divider',
      } satisfies DividerElement;

    case 'date':
      return {
        ...base,
        type: 'date',
        width_mm: 30,
        height_mm: 6,
        mode: 'today',
        csvColumn: 'date',
        staticDate: '',
        format: 'DD/MM/YYYY',
        labelText: 'Date:',
        showDottedLine: true,
        fontSize: 9,
        fontFamily: 'NotoSans',
        color: '#000000',
        name: 'Date',
      } satisfies DateElement;

    case 'rect':
      return {
        ...base,
        type: 'rect',
        width_mm: 20,
        height_mm: 10,
        fillColor: '#F0F0F0',
        borderColor: '#000000',
        borderWidth_mm: 0.2,
        cornerRadius_mm: 0,
        name: 'Rectangle',
      } satisfies RectElement;

    case 'price':
      return {
        ...base,
        type: 'price',
        width_mm: 30,
        height_mm: 10,
        amountSource: 'csv_column',
        amountStatic: '0.00',
        amountCsvColumn: 'price',
        salePriceSource: 'none',
        salePriceStatic: '',
        salePriceCsvColumn: 'sale_price',
        currency: '$',
        currencyPosition: 'before',
        thousandsSeparator: ',',
        decimalSeparator: '.',
        decimals: 2,
        fontSize: 14,
        fontFamily: 'NotoSans',
        fontWeight: 'bold',
        color: '#000000',
        saleColor: '#888888',
        align: 'right',
        name: 'Price',
      } satisfies PriceElement;

    case 'country':
      return {
        ...base,
        type: 'country',
        width_mm: 25,
        height_mm: 5,
        source: 'static',
        staticCountry: 'Cambodia',
        csvColumn: 'country',
        countryCode: 'KH',
        prefix: 'Made in',
        showFlag: true,
        showName: true,
        showCode: false,
        fontSize: 8,
        fontFamily: 'NotoSans',
        color: '#5A606C',
        align: 'left',
        name: 'Origin',
      } satisfies CountryElement;
  }
}
