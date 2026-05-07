// Sticker / canvas size presets, grouped by usage. Sizes are stored in mm
// internally; presets defined in pixels are converted on selection.

export const PX_PER_MM = 96 / 25.4; // CSS pixel at 96 DPI

export interface SizePreset {
  label: string;
  width_mm: number;
  height_mm: number;
  description?: string;
}

export interface SizePresetGroup {
  group: string;
  presets: SizePreset[];
}

const px = (w: number, h: number): { width_mm: number; height_mm: number } => ({
  width_mm: Math.round((w / PX_PER_MM) * 10) / 10,
  height_mm: Math.round((h / PX_PER_MM) * 10) / 10,
});

export const SIZE_PRESETS: SizePresetGroup[] = [
  {
    group: 'Sticker labels',
    presets: [
      { label: 'Micro barcode 25×15', width_mm: 25, height_mm: 15 },
      { label: 'Small square 25×25', width_mm: 25, height_mm: 25 },
      { label: 'Small product 38×25', width_mm: 38, height_mm: 25 },
      { label: 'Compact 30×40', width_mm: 30, height_mm: 40 },
      { label: 'Standard landscape 70×50', width_mm: 70, height_mm: 50 },
      { label: 'Standard portrait 50×70', width_mm: 50, height_mm: 70 },
      { label: 'Medium square 50×50', width_mm: 50, height_mm: 50 },
      { label: 'Medium portrait 70×100', width_mm: 70, height_mm: 100 },
      { label: 'Large square 100×100', width_mm: 100, height_mm: 100 },
      { label: 'A6 label 105×148', width_mm: 105, height_mm: 148 },
      { label: 'Thermal shipping 100×150', width_mm: 100, height_mm: 150 },
    ],
  },
  {
    group: 'Web & social',
    presets: [
      {
        label: 'Instagram square (1080×1080 px)',
        ...px(1080, 1080),
        description: 'Feed post / profile grid',
      },
      {
        label: 'Instagram portrait (1080×1350 px)',
        ...px(1080, 1350),
        description: '4:5 feed post',
      },
      {
        label: 'Instagram story (1080×1920 px)',
        ...px(1080, 1920),
        description: 'Stories / Reels cover',
      },
      {
        label: 'Facebook post (1200×630 px)',
        ...px(1200, 630),
        description: 'Link preview / shared image',
      },
      {
        label: 'Twitter/X post (1200×675 px)',
        ...px(1200, 675),
      },
      {
        label: 'Web product card (800×800 px)',
        ...px(800, 800),
        description: 'Shopify / WooCommerce thumb',
      },
      {
        label: 'Web product hero (1200×1200 px)',
        ...px(1200, 1200),
      },
      {
        label: 'Pinterest pin (1000×1500 px)',
        ...px(1000, 1500),
      },
    ],
  },
  {
    group: 'Paper',
    presets: [
      { label: 'A4 portrait', width_mm: 210, height_mm: 297 },
      { label: 'A4 landscape', width_mm: 297, height_mm: 210 },
      { label: 'A5 portrait', width_mm: 148, height_mm: 210 },
      { label: 'US Letter portrait', width_mm: 215.9, height_mm: 279.4 },
      { label: 'US Letter landscape', width_mm: 279.4, height_mm: 215.9 },
    ],
  },
];
