// Generates resources/icon.png — a 1024×1024 app icon.
// Uses Puppeteer (already a runtime dep) to rasterise an inline SVG so we
// don't need to add `sharp` or another image library just for this.
//
// Run with: node scripts/generate-icon.mjs
//
// electron-builder reads this PNG and derives .icns (macOS) and .ico (Windows)
// from it during npm run build:*.
//
// Design (0.6.x):
//   - Deep-charcoal background (#16181C) — matches the theme's `fg-base`
//     token, so the icon feels native to the app's dark sidebar mark.
//   - White price-tag silhouette tilted -8° for a touch of personality
//     without feeling playful. Standard "address label" shape: rounded
//     rectangle with a pointed left end + a circular hole where the
//     string would attach.
//   - "LS" centered in bold charcoal — large enough to read at 16px
//     Dock-overflow sizes.
//   - Small brand-blue "KH" pill below the "LS", quiet but visible.
//
// Three colors total (charcoal / white / brand-blue) — the same trio the
// app uses across sidebar, theme tokens, and CTAs.

import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const out = join(projectRoot, 'resources', 'icon.png');

const BG = '#16181C';   // app fg-base / sidebar mark background
const TAG = '#FFFFFF';  // tag fill
const INK = '#16181C';  // text on the tag (matches bg for high contrast)
const ACCENT = '#1063E8'; // brand-blue — KH pill

// SVG dimensions chosen so the tag occupies ~70% of the 1024 canvas,
// leaving safe-area for the macOS squircle mask. The path draws a
// horizontal tag with a pointed left end, rounded right corners, and a
// circular hole on the left for the "string" detail.
const html = `<!doctype html>
<html><head><style>
  html, body { margin: 0; padding: 0; }
  body {
    width: 1024px; height: 1024px;
    background: ${BG};
    display: flex; align-items: center; justify-content: center;
  }
  .tilt { transform: rotate(-8deg); transform-origin: center center; }
  svg { display: block; }
  text {
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue",
                 system-ui, sans-serif;
  }
</style></head><body>
  <div class="tilt">
    <svg width="720" height="480" viewBox="0 0 720 480" xmlns="http://www.w3.org/2000/svg">
      <!-- Tag silhouette: pointed-left, rounded-right, like a classic
           address / clothing tag. Coordinates chosen so the pointed
           tip sits at (0, 240) and the rounded right corners use a
           60-unit corner radius. -->
      <path d="
        M 160 0
        L 660 0
        Q 720 0, 720 60
        L 720 420
        Q 720 480, 660 480
        L 160 480
        L 0 240
        Z
      " fill="${TAG}" />

      <!-- Hole detail on the left end. Sized + positioned to read as
           a real eyelet rather than a typo. Filled with the BG color
           so the canvas behind the tag shows through cleanly. -->
      <circle cx="170" cy="240" r="38" fill="${BG}" />

      <!-- "LS" wordmark. Centered slightly right of geometric center
           to balance the pointed left end. 280px is the largest
           that comfortably fits while leaving room for the KH pill
           below it. -->
      <text
        x="445"
        y="240"
        fill="${INK}"
        font-size="280"
        font-weight="900"
        letter-spacing="-8"
        text-anchor="middle"
        dominant-baseline="central"
      >LS</text>

      <!-- "KH" pill: 130 × 48 rounded chip in brand-blue with white
           letters. Sits just below the LS baseline, anchored to the
           same X so the two stack on one optical axis. -->
      <rect x="380" y="375" width="130" height="52" rx="26" fill="${ACCENT}" />
      <text
        x="445"
        y="401"
        fill="#FFFFFF"
        font-size="30"
        font-weight="700"
        letter-spacing="3"
        text-anchor="middle"
        dominant-baseline="central"
      >KH</text>
    </svg>
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
