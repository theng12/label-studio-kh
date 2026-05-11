# Label Studio KH

**Desktop label design and bulk generation, offline.**

A self-contained Electron desktop app for designing print-ready product label
stickers and generating them in bulk from CSV/Excel data. Built for wholesale
and distribution businesses managing many brands and many SKUs.

- Multi-brand, multi-template, multi-language (EN, KM, TH, KO, ZH, JA).
- Drag-and-drop designer with mm-precise layout, 11 element types
  (logo, barcode, QR, text, image, color bar, cert badge, divider, date,
  rectangle, SKU).
- One-click bulk export to PDF / PNG / JPEG via headless Chromium (Puppeteer).
- Local SQLite index of every SKU and every generated file. Reprint from
  snapshot guarantees identical output even after the template changes.
- Free, with all features unlocked. Donations via NOWPayments support
  ongoing development.
- Auto-updates from GitHub Releases — restart prompt when a new version
  finishes downloading.

---

## Download

Pre-built installers live on the
**[Releases page](https://github.com/theng12/label-studio-kh/releases/latest)**.

| Platform | File | Notes |
|---|---|---|
| **macOS (Apple Silicon)** | `Label Studio KH-x.y.z-arm64.dmg` | M1 / M2 / M3 / M4 Macs |
| **macOS (Intel)** | `Label Studio KH-x.y.z-x64.dmg` | Pre-2020 Intel Macs |
| **Windows** | `Label Studio KH Setup-x.y.z.exe` | Windows 10 / 11, 64-bit |

### Installing on macOS

Builds are unsigned (working on it). On first launch you'll see *"Apple cannot
verify this developer"* — that's macOS Gatekeeper being cautious, not a
problem with the file. To get past it:

1. Move the app to `/Applications/` (drag from the DMG)
2. **Right-click** (or Control-click) the app → **Open**
3. Click **Open** in the dialog. macOS remembers this choice for the app.

After this one-time step, the app launches normally forever, and the in-app
auto-updater handles every subsequent version without prompts.

If macOS still refuses (newer macOS versions are stricter), run this in
Terminal to clear the quarantine attribute:

```bash
xattr -cr "/Applications/Label Studio KH.app"
```

### Installing on Windows

You may see a SmartScreen warning (*"Windows protected your PC"*) on the
unsigned installer. Click **More info** → **Run anyway**. Same situation as
macOS — the app is fine, just not paying for a code-signing certificate yet.

---

## Quick start (development)

```bash
npm install            # also rebuilds better-sqlite3 against Electron via postinstall
npm run dev            # opens the Electron window
```

The app stores user data under macOS
`~/Library/Application Support/label-studio-kh/`:
`brands.json`, `templates/`, `assets/`, `label-studio-kh.db`, `settings.json`,
`demo-products.csv`. On Windows, the equivalent is `%APPDATA%\label-studio-kh\`.

## Building installers

```bash
node scripts/download-fonts.mjs   # one-time: ~95MB Noto Sans bundle (gitignored)
npm run build:mac                 # → dist/Label Studio KH-<version>-{arm64,x64}.dmg
npm run build:win                 # → dist/Label Studio KH Setup-<version>.exe
npm run build:all                 # both platforms in one run
```

`build:mac` produces **two** DMGs by default (arm64 + Intel x64). To rebuild
faster during local iteration, drop `x64` from `mac.target.arch` in
`electron-builder.yml`.

### Publishing a release

```bash
GH_TOKEN=ghp_… npm run build:all -- --publish always
```

The `GH_TOKEN` only needs `repo` scope. electron-builder creates a draft
GitHub Release tagged from `package.json`'s version, uploads the artifacts,
and the in-app auto-updater starts seeing it once you publish the draft.

End users **never** see this token — it's used only at upload time.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the app in development with HMR |
| `npm run build:mac` | Build `.dmg` installers for macOS (both arches) |
| `npm run build:win` | Build an `.exe` NSIS installer for Windows |
| `npm run build:all` | Both platforms |
| `npm run lint` | ESLint over `src/` |
| `npm run type-check` | TypeScript without emitting |
| `npm run bench` | Generate 1000 labels and measure throughput |
| `npm run icon` | Re-render `resources/icon.png` from `scripts/generate-icon.mjs` |

## Project layout

```
label-studio-kh/
├── src/
│   ├── main/              ← Electron main process
│   │   ├── ipc/           ← One file per IPC domain (app, brand, template, import, export, file, dashboard, settings, sku, dialog, barcode)
│   │   └── services/      ← Business logic (BrandService, TemplateService, ImportService, ExportService, StickerRenderer, FileService, StatsService, SettingsService, FontService, Updater, DemoSeed, Database, BarcodeService, EnvLoader)
│   ├── preload/           ← Secure IPC bridge — exposes window.api to renderer
│   ├── renderer/          ← React app (Vite + Tailwind + Zustand)
│   │   ├── pages/         ← Dashboard, Brands, Templates, DataImport, Generate, Barcodes, Files, Settings, Support, Designer
│   │   ├── designer/      ← Canvas, Palette, Layers, Properties, BottomBar, TopBar, ElementView, PreviewActualSize, AlignmentToolbar
│   │   ├── components/    ← Shared UI (Button, FormField, ConfirmDialog, NewBrandWizard, Page, Sidebar, Toast, WhatsNew, …)
│   │   ├── stores/        ← Zustand: brand, template, designer, theme, settings, import
│   │   └── i18n.ts        ← i18next bootstrap
│   └── shared/            ← Types shared between main & renderer (brand, template, import, sizePresets, format)
├── locales/               ← i18next JSON files (en, km, th, ko, zh, ja)
├── resources/
│   ├── fonts/             ← Bundled Noto Sans (12 files, OFL)
│   └── icon.png           ← App icon (1024×1024 master; electron-builder derives .icns/.ico)
├── scripts/               ← Maintenance tools (icon, fonts, benchmark)
├── CHANGELOG.md           ← User-visible release notes (also rendered by the in-app "What's new" panel)
└── electron-builder.yml   ← Installer config + GitHub Releases publish target
```

## Auto-update

Production builds check GitHub Releases for newer versions on launch and
download in the background. When the download completes, an in-app toast
offers "Restart now" — one click installs and relaunches on the new version.
If dismissed, the update installs the next time the app quits, so no click
is ever strictly required.

Development builds skip the update check entirely.

## Donations

Label Studio KH is free with all features unlocked. The app's
**Settings → Support development** page links to a NOWPayments donation
widget — donors can pay in any of 200+ coins, conversion + payout handled
on our end. There is no functional difference between donors and
non-donors; donations just keep the app maintained.

## Contributing

Issues and pull requests welcome. Before submitting:

```bash
npm run type-check
npm run lint
npm run build:mac    # smoke test
```

The codebase favors small, well-commented files. Each property panel,
service, and IPC domain has its own file. Comments explain *why* a piece
of code exists, not what each line does.

## Tech stack

- Electron 33, electron-vite, React 18, TypeScript (strict)
- Tailwind CSS with CSS-variable theming (light/dark/system)
- Zustand for state, React Router for routing
- Puppeteer (bundled Chromium) for PDF/PNG/JPEG output
- JsBarcode + qrcode for barcodes/QR (offline, no API key)
- PapaParse + SheetJS for CSV/XLSX
- better-sqlite3 for the local database
- i18next for UI translations
- Bundled Noto Sans for full Unicode coverage in print output
- electron-builder for installers, electron-updater for auto-update

## License

[MIT](./LICENSE).
