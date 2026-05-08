import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';

// Each entry maps a CSS family name → file under resources/fonts/.
// The .ttf/.otf files are gitignored — `node scripts/download-fonts.mjs`
// fetches them. Missing files are silently skipped at render time so a
// partially-bundled install still runs (it just falls back to system fonts).
export interface FontDef {
  family: string;
  weight: 400 | 700;
  file: string;
}

export const FONT_DEFS: readonly FontDef[] = [
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

export function fontsDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'fonts')
    : join(process.cwd(), 'resources', 'fonts');
}

export interface FontStatus {
  loaded: string[];
  missing: string[];
  total: number;
}

export function getFontStatus(): FontStatus {
  const root = fontsDir();
  const loaded: string[] = [];
  const missing: string[] = [];
  for (const def of FONT_DEFS) {
    if (existsSync(join(root, def.file))) loaded.push(def.file);
    else missing.push(def.file);
  }
  return { loaded, missing, total: FONT_DEFS.length };
}

export function fontFaceCss(): string {
  const root = fontsDir();
  const blocks: string[] = [];
  for (const def of FONT_DEFS) {
    const path = join(root, def.file);
    if (!existsSync(path)) continue;
    const format = def.file.endsWith('.otf') ? 'opentype' : 'truetype';
    blocks.push(
      `@font-face{font-family:'${def.family}';font-weight:${def.weight};` +
        `font-style:normal;font-display:swap;src:url('${pathToFileURL(path).href}') format('${format}');}`,
    );
  }
  return blocks.join('\n');
}
