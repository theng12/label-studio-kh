// Common filename-pattern presets used by the Generate page and the Settings
// "Default file naming" field. Picking one fills the text input; the user can
// then tweak it. Tokens recognised by the export engine: {SKU}, {Brand},
// {Size}, {Date}, {Name}, {Index}.

export interface FilenamePreset {
  label: string;
  pattern: string;
  example: string;
  description?: string;
}

export const FILENAME_PRESETS: FilenamePreset[] = [
  {
    label: 'SKU only',
    pattern: '{SKU}',
    example: 'GH-R4602.pdf',
    description: 'Shortest. Risky if you generate the same SKU at multiple sizes.',
  },
  {
    label: 'SKU + size',
    pattern: '{SKU}_{Size}',
    example: 'GH-R4602_70x50mm.pdf',
    description: 'Default. Distinct files per size; easy to filter.',
  },
  {
    label: 'Brand + SKU',
    pattern: '{Brand}_{SKU}',
    example: 'Royal_GH-R4602.pdf',
  },
  {
    label: 'Brand + SKU + size',
    pattern: '{Brand}_{SKU}_{Size}',
    example: 'Royal_GH-R4602_70x50mm.pdf',
    description: 'Longest unambiguous. Good when mixing brands in one folder.',
  },
  {
    label: 'SKU + date',
    pattern: '{SKU}_{Date}',
    example: 'GH-R4602_20260506.pdf',
    description: 'Useful when you re-generate the same SKU and want history.',
  },
  {
    label: 'SKU + product name',
    pattern: '{SKU}_{Name}',
    example: 'GH-R4602_Stainless_Grab_Bar.pdf',
    description: 'Human-readable filename. Names get sanitised + truncated.',
  },
  {
    label: 'Index + SKU',
    pattern: '{Index}_{SKU}',
    example: '0001_GH-R4602.pdf',
    description: 'Sorted in CSV order — handy for sequential print queues.',
  },
  {
    label: 'Brand / SKU / date / size',
    pattern: '{Brand}_{SKU}_{Date}_{Size}',
    example: 'Royal_GH-R4602_20260506_70x50mm.pdf',
  },
];

export const TOKENS_HELP = '{SKU} {Brand} {Size} {Date} {Name} {Index}';
