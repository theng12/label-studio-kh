# Changelog

All notable changes to Label Studio KH are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [SemVer](https://semver.org/spec/v2.0.0.html). Until 1.0.0,
minor versions can introduce breaking changes; we'll call them out clearly.

## [0.2.5] — 2026-05-11

### Added

- **What's New panel.** A small "What's new" link sits next to the version
  in the sidebar footer. Clicking it opens a panel with the recent
  changelog entries (this one, the one before it, etc.) parsed from
  `CHANGELOG.md` itself — so the in-app notes always match what shipped.
  The panel auto-opens the first time you launch a new version so you
  don't miss what changed; closing it remembers the version and won't
  re-prompt until the next update.
- **Settings — bundled fonts explainer.** A small `?` button next to the
  bundled-fonts row pops an inline explanation: what "bundled fonts"
  actually means (12 Noto Sans files shipped inside the app), why we
  bundle them instead of relying on system fonts (label rendering goes
  through headless Chromium for reproducibility across machines),
  whether you need to install anything yourself (no — they're in the
  DMG), and how to use your own fonts on labels (the per-element Font
  picker in the designer lists every font installed on your computer
  alongside the bundled set).
- **Auto-restart prompt after an update.** When the auto-updater
  finishes downloading a new build, an in-app toast appears with a
  "Restart now" button. One click quits the app and relaunches it on
  the new version — no manual quit-and-reopen. If you dismiss the
  toast, the update still installs the next time the app quits, so no
  click is ever required. The Settings → About → "Check for updates"
  button is now wired up too (was previously a placeholder).

## [0.2.4] — 2026-05-11

### Added

- **Templates page — brand-swap hint + context banner.** The brand selector
  at the top now sits in a panel showing the brand swatch, name, and a
  one-line tip explaining that switching the dropdown reveals another
  brand's templates — and that new templates created here will belong to
  the currently selected brand.
- **Data & Import — target-brand banner.** The brand selector on the
  Import tab is now visually highlighted (accent-tinted background, brand
  swatch, name) with an inline explanation that imported rows will become
  SKUs of the currently selected brand.
- **Import history — delete individual entries + clear all.** Each row
  gets a trash-can action; a "Clear all history" button removes every
  entry. Both are gated by a Confirm dialog that explains the audit-log
  semantics: SKUs, brands, templates, and generated files are unaffected;
  re-imports always overwrite SKUs by SKU code regardless of history. A
  permanent inline note on the page restates this so the answer is
  visible without having to attempt a delete to find out.
- **Generate — folder organization preview diagram.** Below the folder
  organization dropdown, a small monospace tree shows where files will
  land for the current setting using the user's actual output folder,
  brand name, template size, and filename pattern. Updates live as any
  input changes.
- **Generate — sample-first nudge on the scope dropdown.** When scope is
  set to "All" and there are more than 20 SKUs, a tip points users at the
  First-5 / First-10 sample options as a way to smoke-test fonts, layout,
  and barcode scannability before committing to a full multi-thousand
  render.
- **File Manager — pagination + sortable columns.** The previous hardcoded
  500-row cap is gone. Files are paginated (25 / 50 / 100 / 200 / 500 per
  page) with first / prev / next / last controls and an X of N counter,
  and every header (SKU, Brand, Size, Format, DPI, Generated, Filename)
  is click-to-sort with direction toggle. The list call now goes through
  a paginated IPC; the old non-paginated IPC is kept as a back-compat
  shim for the previous DMG.

## [0.2.3] — 2026-05-11

### Changed

- **Barcode resizing defaults to locked aspect ratio.** A stretched barcode
  is still a valid encode but looks wrong on shelf and inconsistent next to
  the logo. Joins QR / Logo / Cert / Image in the default-locked set. Hold
  Shift while dragging a handle to override, same as the other locked types.
- **Text element now supports `{column_name}` placeholders in static text.**
  Type a literal like `1 UNIT OF {product_name}` and at export time the
  placeholder is replaced with that row's `product_name`. The prefix and the
  column are both fully editable — pick any wording and any column. Unknown
  columns render as-is so typos are visible on the label rather than
  silently producing blanks. Generate-page preview shows the expanded text.

### Removed

- **Strip box element retired from the palette.** It rendered a hardcoded
  `1 UNIT OF {product_name}` label and had no properties panel, so the
  prefix and column choice were stuck. The Text element now covers the
  same use case (see above) with full font / color / multiline / alignment
  control. Existing strip elements in saved templates continue to load and
  render — only the palette tile is gone, so no new ones can be added.

## [0.2.2] — 2026-05-09

### Added

- **Designer — discoverable CSV column picker.** Every "From CSV column"
  field in the property panel (Text, SKU, Barcode, QR, Image, Country, Date,
  Price, Sale price) now offers a built-in dropdown of the standard product
  columns — `sku`, `product_name`, `barcode`, `description`, `variant`,
  `unit_qty`, `unit_word`, `product_url`, `product_image_path`, `date`,
  `notes` — plus the per-element conventional extras (`country`, `price`,
  `sale_price`). You can still type any custom column name, including
  user-defined columns preserved in `extra_json`.

## [0.2.1] — 2026-05-09

### Added

- **Brand wizard warns on empty Identity/Contact.** Saving a brand with every
  Identity and Contact field blank (website, address, phone, email, tagline,
  established year) now surfaces a soft-block warning. "Brand info" elements
  on labels would otherwise render blank with no hint of why. Save anyway is
  still one click.
- **Designer alignment toolbar — centre, fill, match-size.** Three new
  selection-relative actions in the existing floating toolbar above the
  canvas. Centre on canvas shifts the selection's bounding box to the canvas
  centre; Fill grows each selected element to the full canvas; Match-size
  copies width/height/both from the bottom-most (lowest-zIndex) selection.
  Toolbar now appears with ≥1 element selected; per-button enablement
  reflects the minimum selection count.
- **Settings — bundled-fonts status row.** Indicator showing how many of the
  12 bundled Noto Sans fonts loaded. Green tick when all present; amber
  warning + expandable file list and one-line download nudge when partial.
- **Brand & file delete — undo via toast.** Outside the Designer, deleting a
  brand or generated file is no longer instantly permanent. Toast surfaces an
  Undo button (8 s window). Defer-then-purge architecture: brand delete
  writes a `deletedAt` tombstone in `brands.json`; file delete sets a
  `deleted_at` column on `generations` (schema **v3** migration). Tombstoned
  rows are filtered from list views; restore clears them; permanent purge
  runs at next app start, unlinking files from disk.

### Fixed

- **Import dedup step: action button reachable without scrolling.** With many
  conflicts (e.g. re-importing 1000 SKUs against an existing 1000), the
  conflicts table grew unbounded and pushed the "Import N decisions" button
  far below the viewport. Conflicts table is now capped at 60 vh with a
  scrollable inner area and a sticky header — the action bar stays in view.

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
