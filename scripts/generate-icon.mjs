// Generates resources/icon.png — a 1024×1024 placeholder app icon.
// Uses Puppeteer (already a runtime dep) to rasterise an inline SVG so we
// don't need to add `sharp` or another image library just for this.
//
// Run with: node scripts/generate-icon.mjs
//
// electron-builder reads this PNG and derives .icns (macOS) and .ico (Windows)
// from it during npm run build:*.

import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const out = join(projectRoot, 'resources', 'icon.png');

const BG = '#1063E8'; // brand blue (matches the Demo brand color)
const FG = '#FFFFFF';

const html = `<!doctype html>
<html><head><style>
  html, body { margin: 0; padding: 0; }
  body { width: 1024px; height: 1024px; background: ${BG};
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue", sans-serif;
  }
  .frame { position: relative; width: 720px; height: 720px; }
  .corner { position: absolute; width: 80px; height: 80px;
    border-color: ${FG}; border-style: solid; border-width: 0; }
  .tl { top: 0; left: 0; border-top-width: 16px; border-left-width: 16px; border-top-left-radius: 24px; }
  .tr { top: 0; right: 0; border-top-width: 16px; border-right-width: 16px; border-top-right-radius: 24px; }
  .bl { bottom: 0; left: 0; border-bottom-width: 16px; border-left-width: 16px; border-bottom-left-radius: 24px; }
  .br { bottom: 0; right: 0; border-bottom-width: 16px; border-right-width: 16px; border-bottom-right-radius: 24px; }
  .text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: ${FG}; font-weight: 800; font-size: 280px; letter-spacing: -8px; }
</style></head><body>
  <div class="frame">
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>
    <div class="text">LS</div>
  </div>
</body></html>`;

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buf = await page.screenshot({ type: 'png', omitBackground: false });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  console.log(`Wrote ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
} finally {
  await browser.close();
}
