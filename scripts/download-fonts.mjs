#!/usr/bin/env node
// Download Noto Sans (regular + bold) for all six bundled scripts into
// resources/fonts/. Idempotent: skips files that already exist.
//
// Run with: node scripts/download-fonts.mjs

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const fontsDir = join(projectRoot, 'resources', 'fonts');
mkdirSync(fontsDir, { recursive: true });

const NOTO = 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io@main/fonts';
const CJK = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF';

const FILES = [
  ['NotoSans-Regular.ttf',      `${NOTO}/NotoSans/hinted/ttf/NotoSans-Regular.ttf`],
  ['NotoSans-Bold.ttf',         `${NOTO}/NotoSans/hinted/ttf/NotoSans-Bold.ttf`],
  ['NotoSansKhmer-Regular.ttf', `${NOTO}/NotoSansKhmer/hinted/ttf/NotoSansKhmer-Regular.ttf`],
  ['NotoSansKhmer-Bold.ttf',    `${NOTO}/NotoSansKhmer/hinted/ttf/NotoSansKhmer-Bold.ttf`],
  ['NotoSansThai-Regular.ttf',  `${NOTO}/NotoSansThai/hinted/ttf/NotoSansThai-Regular.ttf`],
  ['NotoSansThai-Bold.ttf',     `${NOTO}/NotoSansThai/hinted/ttf/NotoSansThai-Bold.ttf`],
  ['NotoSansKR-Regular.otf',    `${CJK}/Korean/NotoSansCJKkr-Regular.otf`],
  ['NotoSansKR-Bold.otf',       `${CJK}/Korean/NotoSansCJKkr-Bold.otf`],
  ['NotoSansSC-Regular.otf',    `${CJK}/SimplifiedChinese/NotoSansCJKsc-Regular.otf`],
  ['NotoSansSC-Bold.otf',       `${CJK}/SimplifiedChinese/NotoSansCJKsc-Bold.otf`],
  ['NotoSansJP-Regular.otf',    `${CJK}/Japanese/NotoSansCJKjp-Regular.otf`],
  ['NotoSansJP-Bold.otf',       `${CJK}/Japanese/NotoSansCJKjp-Bold.otf`],
];

console.log('Downloading Noto Sans fonts to resources/fonts/...');
let total = 0;
for (const [filename, url] of FILES) {
  const dest = join(fontsDir, filename);
  if (existsSync(dest)) {
    console.log(`  ✓ ${filename} (already present)`);
    continue;
  }
  process.stdout.write(`  ⟳ ${filename}... `);
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) {
      process.stdout.write(`HTTP ${r.status}\n`);
      continue;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(dest, buf);
    total += buf.length;
    process.stdout.write(`${(buf.length / 1024 / 1024).toFixed(1)} MB\n`);
  } catch (err) {
    process.stdout.write(`FAILED: ${err.message}\n`);
  }
}
console.log(`\nTotal downloaded: ${(total / 1024 / 1024).toFixed(1)} MB`);
console.log('License: SIL Open Font License — free to redistribute.');
