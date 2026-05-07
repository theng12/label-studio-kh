# Changelog

All notable changes to Label Studio KH are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [SemVer](https://semver.org/spec/v2.0.0.html). Until 1.0.0,
minor versions can introduce breaking changes; we'll call them out clearly.

## [0.2.0] — 2026-05

A substantial round of additions on top of the spec-complete 0.1.0.

### Added

- **Brand assets — actual upload UI.** The wizard's Logo (step 2) and
  Certifications (step 5) panels are no longer stubs. Drag-and-drop or pick
  PNG / JPG / JPEG / SVG / WEBP. Picked files are copied into the brand's
  permanent assets folder under `userData/assets/<brandId>/` on submit. Edit
  mode supports replace and remove.
- **Manual SKU entry.** New "Manual entry" tab on Data & Import. Form for
  adding a single SKU without going through CSV import. "Save and add another"
  resets the form for rapid bulk entry; saving an existing SKU upserts.
- **CSV template download.** "Don't have a file yet?" card on the Import tab
  generates a CSV with all 12 standard columns and one realistic example row.
- **Brand edit and delete.** Each brand card has hover-revealed pencil and
  trash buttons. Edit re-opens the wizard pre-filled. Delete confirms and is
  blocked for the demo brand.
- **Price element.** Currency symbol with before/after position, configurable
  thousands and decimal separators, configurable decimals. Optional sale price
  (CSV column or static); when set, the regular price renders smaller with a
  strikethrough beside the prominent sale price.
- **Multi-line text.** Text element gains an optional "multi-line" mode with
  line-height and vertical-align controls. Wraps within the box, respects
  `maxChars` truncation. Single-line behaviour unchanged.
- **Country of origin element.** ISO 2-letter code → flag emoji, configurable
  prefix ("Made in", etc.), independent toggles for flag / name / code.
- **mm ↔ px toggle.** Templates remain millimetre-canonical internally; the
  toggle controls how W/H pills display and accept input. Conversion at 96 DPI
  (≈ 3.7795 px/mm).
- **Size presets dropdown.** 11 sticker label sizes from the spec, plus a Web
  & social group (Instagram square / portrait / story, Facebook 1200×630,
  Twitter 1200×675, web product cards 800/1200, Pinterest 1000×1500), plus a
  Paper group (A4, A5, US Letter portrait + landscape).
- **Image element URL support.** The image element's CSV column can hold
  either a local file path or an `https://...` URL. The Properties panel now
  exposes data source switch, CSV column, static-asset picker, and object-fit.

### Changed

- **Designer top bar / brand wizard header are draggable.** Previously only
  the sidebar's top row could be used to move the window on macOS. Both bars
  now opt into `-webkit-app-region: drag` with interactive children explicitly
  marked `no-drag`.
- **Orientation control simplified.** The dropdown in the designer top bar
  was redundant once the auto-derive-from-W/H rule landed; removed. Editing W
  or H updates the orientation field automatically.
- **macOS builds default to arm64-only.** Most modern Macs are Apple Silicon;
  halves build time and dist size. Re-enable x64 by adding it back to
  `mac.target[0].arch` in `electron-builder.yml`.
- **Custom `lskh-file://` protocol** for serving local images to the renderer
  without weakening the renderer CSP. Used by logo / cert previews.
- **DataImport.tsx split** into `pages/dataImport/{ImportFlow, ManualEntry,
  SkuLookup, ImportHistory}.tsx` for navigability. No behavioural change.
- **`src/main/ipc/README.md`** rewritten to point at the preload `Api` type as
  the living contract, with a domain-index table.

### Removed (cleanup audit)

- Stale "Duplicate template (coming soon)" disabled button (Phase 1 stub,
  never built).
- Unused npm deps `uuid` and `@types/uuid` (we use Node's built-in
  `crypto.randomUUID()` everywhere).
- Dead `AssetService.fileUrlWithCacheBust` method.
- Unused `LicenseService.generateLicense` (the CLI script reimplements the
  algorithm intentionally — generation should only happen offline with the
  owner's secret, never from the running app).

### Fixed

- The `LICENSE_SECRET` from `.env` now actually reaches the running Electron
  main process (electron-vite only auto-loads `MAIN_VITE_`-prefixed vars; we
  added an explicit `EnvLoader`).
- Activation errors in the License page surface as visible messages instead
  of silent no-ops.

## [0.1.0] — 2026-05

Initial release covering the full spec scope across the four phases:

- **Phase 1 — Foundation:** Electron + React + TypeScript + Vite + Tailwind
  scaffold; sidebar with all nav items; light/dark/system theme; brand /
  template data models; full template designer with 12 element types
  (logo, barcode, qr, sku, text, image, color bar, strip, cert, divider, date,
  rect), drag/drop, resize, multi-select, undo/redo (50-step history),
  keyboard shortcuts, layers panel, properties panel, mm-based canvas with
  zoom + 1mm snap.
- **Phase 2 — Import & Generation:** CSV/Excel import with auto column
  mapping, validation, SKU dedup; SQLite database (skus, imports, batches,
  generations); Puppeteer-driven bulk export to PDF / PNG / JPEG with
  filename token resolution and folder organisation; Generate page with live
  preview, modal progress dialog, cancel + ETA.
- **Phase 3 — Polish & Features:** Live dashboard stats; File Manager with
  search, filters, reprint-from-snapshot, open in OS, delete; demo brand
  auto-seeded on first launch; designer "Actual size" floating panel;
  size-warning indicator; live max-chars counter; Settings page (theme,
  language, save location, naming pattern, DPI, time-saved estimate, hide
  demo brand); i18n (en, km, th, ko, zh, ja); Noto Sans font loading
  infrastructure with graceful fallback to system fonts.
- **Phase 4 — Release:** HMAC license-key system (cosmetic only — no feature
  gates); license generator CLI; placeholder app icon; macOS DMG installer
  via electron-builder (unsigned); auto-updater scaffolding (opt-in);
  performance benchmark hitting 142 labels/min on M-series Macs.
