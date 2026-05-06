import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { BrandService } from './BrandService';
import { TemplateService } from './TemplateService';
import { paths } from './paths';
import type { Template } from '@shared/types/template';

const DEMO_BRAND_NAME = 'Demo brand';

// A 1×1 transparent PNG as a tiny placeholder. Real Phase 3 would bundle
// proper Noto-stamped PNGs; for now this gives the file system something
// to point at so paths in the data model stay valid.
const ONE_PX_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

function ensureBundledAssets(brandId: string): {
  logoPath: string;
  certPath: string;
  productImagePath: string;
} {
  const dir = paths.assetsDir(brandId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const logoPath = join(dir, 'placeholder-logo.png');
  const certPath = join(dir, 'placeholder-cert.png');
  const productImagePath = join(dir, 'placeholder-product.png');

  const buf = Buffer.from(ONE_PX_PNG_BASE64, 'base64');
  for (const p of [logoPath, certPath, productImagePath]) {
    if (!existsSync(p)) writeFileSync(p, buf);
  }
  return { logoPath, certPath, productImagePath };
}

function demoTemplate(brandId: string, orientation: 'landscape' | 'portrait'): Template {
  const w = orientation === 'landscape' ? 70 : 50;
  const h = orientation === 'landscape' ? 50 : 70;
  const id = orientation === 'landscape' ? 'demo-landscape' : 'demo-portrait';
  const now = new Date().toISOString();

  return {
    id,
    brandId,
    name: orientation === 'landscape' ? 'Demo 70×50' : 'Demo 50×70',
    orientation,
    width_mm: w,
    height_mm: h,
    background: '#FFFFFF',
    elements: [
      {
        id: 'el-bar',
        type: 'colorbar',
        name: 'Top bar',
        x_mm: 0,
        y_mm: 0,
        width_mm: w,
        height_mm: 4,
        visible: true,
        zIndex: 1,
        locked: false,
        color: '#1063E8',
        position: 'top',
      },
      {
        id: 'el-logo',
        type: 'logo',
        name: 'Logo',
        x_mm: 2,
        y_mm: 6,
        width_mm: 12,
        height_mm: 12,
        visible: true,
        zIndex: 2,
        locked: false,
        objectFit: 'contain',
      },
      {
        id: 'el-product',
        type: 'text',
        name: 'Product name',
        x_mm: 16,
        y_mm: 7,
        width_mm: w - 18,
        height_mm: 6,
        visible: true,
        zIndex: 3,
        locked: false,
        dataSource: 'csv_column',
        staticText: '',
        csvColumn: 'product_name',
        fontSize: 10,
        fontFamily: 'NotoSans',
        fontWeight: 'bold',
        color: '#16181C',
        align: 'left',
        maxChars: null,
        language: null,
      },
      {
        id: 'el-sku',
        type: 'sku',
        name: 'SKU',
        x_mm: 16,
        y_mm: 14,
        width_mm: w - 18,
        height_mm: 5,
        visible: true,
        zIndex: 4,
        locked: false,
        dataSource: 'csv_column',
        staticText: '',
        csvColumn: 'sku',
        fontSize: 8,
        fontFamily: 'NotoSans',
        fontWeight: 'normal',
        color: '#5A606C',
        align: 'left',
        maxChars: null,
        language: null,
      },
      {
        id: 'el-barcode',
        type: 'barcode',
        name: 'Barcode',
        x_mm: 2,
        y_mm: h - 18,
        width_mm: w - 22,
        height_mm: 14,
        visible: true,
        zIndex: 5,
        locked: false,
        format: 'EAN-13',
        dataSource: 'csv_column',
        csvColumn: 'barcode',
        manualValue: '',
        showHumanReadable: true,
        showPrefix: true,
        barColor: '#000000',
      },
      {
        id: 'el-qr',
        type: 'qr',
        name: 'QR',
        x_mm: w - 18,
        y_mm: h - 18,
        width_mm: 14,
        height_mm: 14,
        visible: true,
        zIndex: 6,
        locked: false,
        mode: 'dynamic_csv',
        staticUrl: '',
        dynamicBaseUrl: '',
        csvColumn: 'product_url',
        showUrlText: false,
        errorCorrection: 'M',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

const DEMO_CSV_ROWS: Record<string, string>[] = [
  { sku: 'DEMO-001', product_name: 'Stainless Grab Bar 60cm', brand: 'Demo brand', barcode: '8851234567890', product_url: 'https://example.com/p/demo-001' },
  { sku: 'DEMO-002', product_name: 'Stainless Grab Bar 90cm', brand: 'Demo brand', barcode: '8851234567891', product_url: 'https://example.com/p/demo-002' },
  { sku: 'DEMO-003', product_name: 'Towel Rail 600mm', brand: 'Demo brand', barcode: '8851234567892', product_url: 'https://example.com/p/demo-003' },
  { sku: 'DEMO-004', product_name: 'Towel Rail 800mm', brand: 'Demo brand', barcode: '8851234567893', product_url: 'https://example.com/p/demo-004' },
  { sku: 'DEMO-005', product_name: 'Soap Dispenser', brand: 'Demo brand', barcode: '8851234567894', product_url: 'https://example.com/p/demo-005' },
  { sku: 'DEMO-006', product_name: 'Robe Hook Single', brand: 'Demo brand', barcode: '8851234567895', product_url: 'https://example.com/p/demo-006' },
  { sku: 'DEMO-007', product_name: 'Robe Hook Double', brand: 'Demo brand', barcode: '8851234567896', product_url: 'https://example.com/p/demo-007' },
  { sku: 'DEMO-008', product_name: 'Toilet Paper Holder', brand: 'Demo brand', barcode: '8851234567897', product_url: 'https://example.com/p/demo-008' },
];

export const DemoSeed = {
  /** Idempotent seed: only creates the demo brand and templates if they don't already exist. */
  ensure(): { created: boolean; brandId: string } {
    const brands = BrandService.list();
    const existing = brands.find((b) => b.isDemo);
    if (existing) return { created: false, brandId: existing.id };

    const now = new Date().toISOString();
    // Create brand first (without paths) so we can set up assets dir under its id.
    const brand = BrandService.create({
      name: DEMO_BRAND_NAME,
      color: '#1063E8',
      logoPath: null,
      defaultFont: 'NotoSans',
      website: 'https://example.com',
      address: '1 Example Street, Phnom Penh',
      phone: '+855 12 345 678',
      email: 'hello@example.com',
      certBadges: [],
      tagline: 'Sample data for testing',
      establishedYear: '2026',
      category: 'Hardware',
      customerCareLabel: 'Customer care',
      isDemo: true,
    });

    const assets = ensureBundledAssets(brand.id);
    BrandService.update(brand.id, {
      logoPath: assets.logoPath,
      certBadges: [assets.certPath],
    });

    TemplateService.save(demoTemplate(brand.id, 'landscape'));
    TemplateService.save(demoTemplate(brand.id, 'portrait'));

    // Drop a sample CSV next to the assets dir so the user can find it.
    const sampleCsvPath = join(app.getPath('userData'), 'demo-products.csv');
    if (!existsSync(sampleCsvPath)) {
      const headers = Object.keys(DEMO_CSV_ROWS[0]!).join(',');
      const lines = DEMO_CSV_ROWS.map((r) =>
        Object.values(r)
          .map((v) => (v.includes(',') ? `"${v}"` : v))
          .join(','),
      );
      writeFileSync(sampleCsvPath, [headers, ...lines].join('\n'), 'utf8');
    }

    void now;
    return { created: true, brandId: brand.id };
  },
};
