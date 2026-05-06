# Label Studio KH

**Desktop label design and bulk generation, offline.**

A self-contained Electron desktop app for designing print-ready product label
stickers and generating them in bulk from CSV/Excel data. Built for wholesale
and distribution businesses managing many brands and many SKUs.

- Multi-brand, multi-template, multi-language (EN, KM, TH, KO, ZH, JA).
- Drag-and-drop designer with mm-precise layout, 12 element types
  (logo, barcode, QR, text, image, color bar, strip, cert badge, divider,
  date, rectangle, SKU).
- One-click bulk export to PDF / PNG / JPEG via headless Chromium (Puppeteer).
- Local SQLite index of every SKU and every generated file. Reprint from
  snapshot guarantees identical output even after the template changes.
- Free, with all features unlocked. Optional cosmetic license.

---

## Quick start (development)

```bash
npm install            # also rebuilds better-sqlite3 against Electron via postinstall
npm run dev            # opens the Electron window
```

The app stores user data under macOS `~/Library/Application Support/label-studio-kh/`
(brands.json, templates/, assets/, label-studio-kh.db, settings.json,
license.json, demo-products.csv).

## Build the desktop installer

```bash
node scripts/download-fonts.mjs   # one-time: ~95MB Noto Sans bundle (gitignored)
npm run build:mac                 # → dist/Label Studio KH-<version>.dmg
npm run build:win                 # → dist/Label Studio KH Setup-<version>.exe (cross-built from Mac)
npm run build:all                 # both
```

Builds are unsigned. macOS users will see a one-time "unidentified developer"
warning on first launch — click through it via Right-click → Open. To sign
properly, fill in `mac.identity` in `electron-builder.yml`.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the app in development with HMR |
| `npm run build:mac` | Produce a signed-or-unsigned `.dmg` for macOS |
| `npm run build:win` | Produce an `.exe` NSIS installer for Windows |
| `npm run lint` | ESLint over `src/` |
| `npm run type-check` | TypeScript without emitting |
| `npm run bench` | Generate 1000 labels and measure throughput |
| `npm run icon` | Re-render `resources/icon.png` from the inline SVG in `scripts/generate-icon.mjs` |
| `npm run license:gen "Name"` | Generate a license key for the given name (requires `LICENSE_SECRET` in `.env`) |

## Project layout

```
label-studio-kh/
├── src/
│   ├── main/              ← Electron main process
│   │   ├── ipc/           ← One file per IPC domain (app, brand, template, import, export, file, dashboard, settings, license)
│   │   └── services/      ← Business logic (BrandService, TemplateService, ImportService, ExportService, StickerRenderer, FileService, StatsService, SettingsService, LicenseService, Updater, DemoSeed, Database)
│   ├── preload/           ← Secure IPC bridge — exposes window.api to renderer
│   ├── renderer/          ← React app (Vite + Tailwind + Zustand)
│   │   ├── pages/         ← Dashboard, Brands, Templates, DataImport, Generate, Files, Settings, Support, Designer
│   │   ├── designer/      ← Canvas, Palette, Layers, Properties, BottomBar, TopBar, ElementView, PreviewActualSize
│   │   ├── components/    ← Shared UI (Button, FormField, ConfirmDialog, NewBrandWizard, Page, Sidebar)
│   │   ├── stores/        ← Zustand: brand, template, designer, license, theme, settings, import
│   │   └── i18n.ts        ← i18next bootstrap
│   └── shared/            ← Types shared between main & renderer (brand, template, import, license)
├── locales/               ← i18next JSON files (en, km, th, ko, zh, ja)
├── resources/
│   ├── fonts/             ← Bundled Noto Sans (12 files, OFL)
│   └── icon.png           ← App icon (1024×1024 master; electron-builder derives .icns/.ico)
├── scripts/               ← Maintenance tools (icon, fonts, license, benchmark)
└── electron-builder.yml   ← Installer config
```

## License system

Label Studio KH is free with all features unlocked. The license system is
**purely cosmetic** — it removes the dashboard donation nudge and adds a small
"Licensed" badge in the sidebar. There are no feature gates, no expiry, no
internet calls.

Validation is HMAC-based and runs on the user's machine. To issue keys:

```bash
echo 'LICENSE_SECRET=your-private-secret-here' >> .env
npm run license:gen "Buyer Name"
# → LC-XXXX-XXXX-XXXX-XXXX
```

Send the buyer both the **exact name** they should enter and the **key**.
They paste both on Settings → Support → Activate.

`LICENSE_SECRET` must remain private. Anyone with it can issue keys.
`.env` is gitignored.

## Auto-update

Auto-update is wired but opt-in. By default the app does not check for updates.
To enable, configure a `publish` block in `electron-builder.yml` (e.g.
GitHub Releases, S3, or a generic URL) and re-build. See
https://www.electron.build/auto-update for details.

## Tech stack

- Electron 33, Vite, React 18, TypeScript
- Tailwind CSS with CSS-variable theming (light/dark/system)
- Zustand for state, React Router for routing
- Puppeteer (bundled Chromium) for PDF/PNG/JPEG output
- JsBarcode + qrcode.js for barcodes/QR (offline, no API key)
- PapaParse + SheetJS for CSV/XLSX
- better-sqlite3 for the local database
- i18next for UI translations
- Bundled Noto Sans for full Unicode coverage in print output
- electron-builder for installers, electron-updater for updates
