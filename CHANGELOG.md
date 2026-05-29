# Changelog

All notable changes to Label Studio KH are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [SemVer](https://semver.org/spec/v2.0.0.html). Until 1.0.0,
minor versions can introduce breaking changes; we'll call them out clearly.

## [0.11.0] — 2026-05-29

**N-up sheet layouts** — pass 2 of the printing hub. Print (or export)
multiple labels per A4/Letter page for office sheet printers, instead
of one-label-per-page.

### Added

- **Print layout toggle** in the Generate page's Print panel:
  - **One per page (roll)** — the 0.10.0 behaviour, for thermal /
    continuous-roll printers.
  - **Sheet (N-up)** — tiles labels into a grid across A4/Letter
    pages for laser/inkjet sheet printers (Avery-style sticker
    sheets).
- **Sheet controls**: page size (A4 / Letter), orientation, outer
  margin (mm), gap between labels (mm). A live readout shows how many
  labels fit per page (e.g. "12 labels per page (3 × 4)") and warns
  when the label is too big to fit even once.
- **Export sheet PDF** button — saves the whole N-up layout as one
  combined PDF to your output folder (for "print later" or sending to
  a print shop), with a Reveal action on the success toast.
- N-up applies to both the direct-print path and the PDF export, using
  the same grid math + per-label rendering as everything else.

### Internal

- `src/shared/sheetLayout.ts` — page dimensions + auto-fit grid math,
  shared between the renderer (live hint) and main (rendering).
- `renderSheet()` in StickerRenderer builds the multi-page sheet doc.
- `PrintService.printLabels` gained an optional `sheet` layout;
  `ExportService.exportSheetPdf` is new. IPC: `export:sheetPdf`.

### Docs

- Added `ROADMAP.md` at the repo root — tracks what's shipped + what's
  planned (ZPL output, backup/restore, product export, bulk edit, more
  barcode symbologies, onboarding, and the strategic bets), with file
  pointers per item for cross-session handoff.

## [0.10.0] — 2026-05-28

**Direct printing** — the app can now print labels straight to a
printer, not just export PDF/PNG/JPEG files. This is pass 1 of the
"printing hub" work (N-up sheet layouts + raw ZPL come next).

### Added

- **Print directly panel** on the Generate page. Pick any printer the
  OS knows about (including thermal / roll label printers with an
  installed driver — Zebra, Dymo, Brother, Xprinter, …), set a copy
  count, and print:
  - **Print N labels** — sends straight to the selected printer, no
    dialog ("press print").
  - **Print dialog…** — opens the native system print dialog for full
    control over printer + options.
- Prints the same scope (All or First-N sample) using the same
  template + product data as Generate, so what prints matches the
  preview and the file export pixel-for-pixel.
- One label per page at the template's exact mm size — correct for
  thermal / continuous-roll printers.
- Completion + cancellation surface as toasts.

### Internal

- New `PrintService` (main) renders labels into a hidden BrowserWindow
  and dispatches via Electron's `webContents.print()` — the only path
  that can reach physical printers + enumerate installed devices
  (Puppeteer's headless Chromium can't).
- New `renderLabelsForPrint()` in StickerRenderer builds a single
  multi-page document (one label per CSS page) reusing the exact same
  element rendering + bundled fonts as the export path.
- IPC: `print:listPrinters`, `print:labels`.

### Coming next (printing hub, pass 2+)

- N-up sheet layouts (multiple labels per A4/Letter page, Avery-style
  presets) for office sheet printers.
- Raw ZPL/EPL output for Zebra/thermal printers that prefer native
  printer code over the OS driver.

## [0.9.0] — 2026-05-28

Adds a real **audit log** + a dedicated **History page** in the sidebar,
and unclutters the Product Library toolbar.

### Added

- **History page** (sidebar → SYSTEM → History, above Settings). A
  global, read-only feed of every recorded change in the active
  workspace: product create / edit / delete, image add / remove /
  set-main / reorder, and CSV imports. Filter by event type (All /
  Products / Images / Imports), paginated 50 per page.
- **Audit log infrastructure.** New `audit_log` table + `AuditService`
  that every mutating operation now writes to:
  - Product create → "Created product MR-001 — …"
  - Product edit → logs ONLY the fields that changed, shown as a
    `field: old → new` diff in the feed.
  - Product delete → snapshot of what was removed.
  - Image add / remove / set-main / reorder → granular per-action
    events.
  - CSV import → one summary event per import ("Imported file.csv —
    12 new, 30 updated").
  - Scoped to the active company; mirrors Image Studio KH's model.
  Added via `CREATE TABLE IF NOT EXISTS`, so existing databases pick
  it up on next launch with no schema-version bump. (Events before
  this release aren't backfilled — the log starts now.)

### Changed

- **Product Library toolbar is now two rows.** Search + result count
  on top (search no longer collapses to a sliver when the action
  buttons crowd it), action buttons below. Fixes the "search field is
  almost gone" squeeze on the single wrapping row.
- **Import history moved.** The standalone _History_ button is gone
  from the Product Library toolbar — import history + the full audit
  log now live on the dedicated History page in the sidebar. The
  import modal still has a contextual "Recent imports →" link.

## [0.8.0] — 2026-05-28

### Fixed

- **Product side panel now syncs to the selected product.** Selecting a
  different product updated the panel header ("Edit theng5") but left the
  form fields showing the previously-selected product's data. The panel
  became always-mounted in 0.7.0 (it used to remount per-open as a modal),
  so its form state stopped re-initialising on selection change. Added a
  re-sync effect keyed on the product id; the form, prices, custom fields,
  and inventory fields now all reflect the row you clicked.
- **Selected row/card indicator.** The product currently open in the side
  panel is now highlighted in the table (accent tint + left accent bar)
  and in the grid (accent ring + tint), so it's always clear which item
  you're editing.

### Changed

- **Templates page shows all templates across all brands by default.**
  Previously you could only see one brand's templates at a time via a
  dropdown. Now the page loads every brand's templates into one view with:
  - **Brand filter pills** at the top — "All brands" (default) plus one
    per brand, each showing a live template count.
  - A **brand chip on every template card** so you can tell which brand a
    template belongs to at a glance.
  - A summary line: "Showing N templates across M brands."
  - Per-template operations (open, rename, duplicate, delete) now use each
    template's own brand, so they work correctly in the mixed "All brands"
    view. New templates belong to the filtered brand, or your default
    brand when "All brands" is selected (shown in the header + button
    tooltip).

## [0.7.2] — 2026-05-26

### Fixed

- **Product Library columns now scroll independently.** Scrolling the
  product edit panel no longer also scrolls the product table/grid (and
  vice-versa). The three-column layout (filters · table · panel) is now
  a fixed-height grid where each column owns its own vertical scroll,
  instead of everything sharing one page-level scrollbar. The toolbar
  (search + buttons) stays pinned at the top of the middle column while
  the table scrolls underneath it.

### Notes (not a bug)

- Deleted products reappearing after an import is **expected upsert
  behaviour**, not a bug: the importer matches rows by Product Code and
  re-inserts any code it finds in the file. If you delete a product but
  the row is still in the CSV you re-import, it comes back. Remove the
  row from the source file (or don't re-import the whole sheet) to keep
  it deleted. The delete confirmation already warns about this.

## [0.7.1] — 2026-05-26

**Pass 2 of 2** for the Image Studio KH Product Library parity. The
Library page now has no top-level tabs at all — every secondary
surface (Import, History) lives in a modal opened from the toolbar.
Single-page, single-purpose: that's the Image Studio model.

### Changed

- **Import wizard is now a modal**, not a tab on the Products page.
  Opens from a new _Import Excel/CSV_ button in the Library toolbar.
  Same 4-step flow (pick → map → dedup → done), same per-SKU dedup
  controls, same `?tab=import` back-compat (now auto-opens the modal
  instead of switching tabs). Esc / backdrop / X all dismiss except
  during the committing step (no accidental mid-write bails).
- **Import history is now a modal too**, opened from a small _History_
  button in the toolbar OR from a _Recent imports →_ link in the
  Import modal's first step.
- **Tabs removed from Products page** entirely. _Library_, _Import_,
  _History_ tab bar is gone. The library content is the page; modals
  surface the rest. Matches Image Studio KH's single-page layout.
- **"View in Library" CTA** on the import Done step now closes the
  modal cleanly + applies the brand filter, instead of navigating to
  a deep-link URL (which would leave the modal stuck open over the
  library).

### Removed

- `TabBtn` component (no tabs to render).
- The `ProductsTab` type union.
- Direct tab-based rendering paths in `Products.tsx` (`tab === 'import'
  ? <ImportFlow /> : tab === 'history' ? <ImportHistory /> : …`).

### Internal

- New `ImportModalShell.tsx` wraps the existing `<ImportFlow>` in a
  Modal shell — no changes to the wizard internals.
- New `HistoryModalShell.tsx` wraps the existing `<ImportHistory>`.
- `<ImportFlow>` gained an optional `onViewInLibrary?: (brandId) =>
  void` prop. When set (i.e. from a modal context), the Done screen's
  primary button calls it instead of navigating, so the parent can
  close the modal + set the brand filter atomically.
- The `/data` legacy route + standalone `DataImport` page still work
  unchanged; they use `<ImportFlow>` without the callback so the
  default navigate-deep-link path fires.

## [0.7.0] — 2026-05-26

Product Library brought to 1:1 parity with Image Studio KH (the sister
app) on the create/edit and sort UX. **Pass 1 of 2** — the import flow
alignment lands in a follow-up.

### Changed

- **Product create / edit is now an inline side panel, not a modal.**
  Clicking a row, a grid card, or _+ New product_ no longer opens a
  blocking modal that dims the rest of the page. Instead, the
  Product Library is a three-column layout: filters · table · _Product
  details_ panel. The panel is always mounted with three internal
  modes (empty placeholder, blank new-product form, edit-existing
  form). Same try-then-commit Save semantics as before, just docked
  instead of overlaid. Matches Image Studio KH's behaviour exactly.
- **Panel on / off toggle** in the toolbar. Hides the right column
  and reclaims ~440px of horizontal space — useful on smaller
  MacBook displays. Choice persists across sessions; defaults OFF
  on viewports narrower than 1400px.
- **Sort dropdown** in the toolbar. Seven options:
  - _Recently updated_ (default — matches the DB's natural order)
  - _Recently added_ / _Oldest added_
  - _Product Code A→Z / Z→A_
  - _Name A→Z / Z→A_

  Sorting is client-side via `useMemo`, so flipping it doesn't
  round-trip to SQLite. `localeCompare(numeric: true)` is used for
  Product Code so codes like MR-001, MR-12, MR-2 sort the way you
  read them.

### Added

- **"+ New product" auto-shows the panel** if it was hidden — so
  clicking the CTA never feels like nothing happened.
- **Row / card click auto-shows the panel** for the same reason.
- The empty-state placeholder in the panel includes a _+ New product_
  button so users can start a new product without leaving the panel.

### Pending (Pass 2)

- Import flow alignment with Image Studio KH (pick → map → preview →
  review with editable conflict policy). Currently still uses the
  tab-based 4-step flow.

## [0.6.2] — 2026-05-20

### Changed

- **New app icon.** Replaced the four-corner "frame around LS"
  placeholder with a proper label-themed icon: deep-charcoal
  background, white price-tag silhouette tilted -8° with a circular
  eyelet on the left end, "LS" centered in bold charcoal, and a
  small brand-blue "KH" pill tucked underneath. Uses the same
  three-color palette (charcoal / white / brand-blue) the rest of
  the app uses — the icon now reads as native to its own UI.
  Regenerated via `npm run icon`; electron-builder derives `.icns`
  + `.ico` from the new PNG.

## [0.6.1] — 2026-05-20

Product Library brought up to Image Studio KH parity on two
long-standing friction points: the brand filter was previously
single-select with no way to see all brands at once, and a finished
CSV import gave you stats but no easy way to actually find the rows
you'd just added.

### Added

- **"All brands" pill** at the top of the Product Library sidebar.
  Selecting it clears the brand filter so you see every product in
  the active company. Mirrors Image Studio KH's behaviour.
- **"View in Library" CTA on the Import Done screen.** Jumps to the
  Library tab pre-filtered to the brand you just imported into, so
  the newly-added rows are visible immediately. Uses the existing
  `/products?brand=<id>` deep link.
- **Toast on import completion.** A one-line summary appears the
  moment the commit succeeds: _"Import complete — 2 new · 32
  updated."_ Mirrors a failure toast on commit error.
- **"(filtered)" hint** in the product-count line whenever search,
  brand, or category filters are active — so you always know if
  you're looking at the full catalogue or a subset.

### Changed

- **Brand filter no longer auto-locks on every page mount.** The
  Library used to force-select a brand every time the page
  re-mounted (e.g. after navigating to Generate and back), which
  silently undid an "All brands" choice. A session-scoped guard now
  ensures the auto-pick only fires once per session, and only when
  the URL doesn't say otherwise.
- **Empty-state copy** now adapts to "All brands" mode: instead of
  always saying "No products for {brand}", it reads "No products in
  this workspace yet" when no brand is selected, and "No products
  match your search" when a search is active.

## [0.6.0] — 2026-05-20

Product Library columns aligned with an external inventory/POS CSV
format. New fields, new default price tiers, and a round of UI label
renames so the product form reads like an inventory form rather than
just a label-design form.

Schema migrates from v6 to v7 on first launch (additive `ALTER TABLE`
only; existing data preserved, new columns default to null / 0).

### Added

- **Six new product fields**, all stored verbatim and round-trippable
  via CSV import/export (Label Studio doesn't act on them — no stock
  counters, no reorder alerts, no tax calculations):
  - **Expiry Date** (ISO `yyyy-mm-dd`)
  - **Tax Rate** (free-text percent, e.g. `10` for 10%)
  - **Reorder Point** (units)
  - **Reorder Quantity** (units)
  - **Track Inventory** (boolean)
  - **Variant Attributes** (free-text, e.g. `"Color: Red, Size: M"`)
- **New "Inventory & lifecycle" section** in the Product form, between
  Custom fields and Images, holding the five new logistics fields.

### Changed

- **UI labels renamed** to match common POS / catalog vocabulary:
  - _SKU_ → **Product Code** (internal field name still `sku`)
  - _Name_ → **Product Name**
  - _Category_ → **Category Name** (in the form)
  - _Unit_ → **Unit of Measure**
- **Default price groups** for new companies changed from
  `['Retail', 'Wholesale']` to `['Cost', 'Selling', 'Wholesale', 'Min
  Selling']` — matches the user's external CSV columns directly.
  Existing companies' configured groups are untouched.
- **CSV import auto-mapper now recognises all the new column names**
  (Product Code, Selling Price, Cost Price, Wholesale Price, Min
  Selling Price, Tax Rate, Expiry Date, Reorder Point, Reorder
  Quantity, Track Inventory, Variant Attributes, Unit of Measure,
  Category Name, Secondary Code) plus common aliases (UOM, VAT,
  Reorder Qty, Min Price, etc.). Older CSVs with `SKU`, `Retail`,
  `Wholesale`, etc. keep working — back-compat aliases stayed.
- **Import partial-update is stronger now**: prices coming in via
  the new columns MERGE with existing tiers rather than blanking
  them, and unmapped category / unit / variant_attributes / inventory
  fields fall back via `COALESCE` so a CSV with only some columns
  doesn't wipe everything else.

### Internal

- Schema v7: six new columns on `skus` (`expiry_date`, `tax_rate`,
  `reorder_point`, `reorder_quantity`, `track_inventory`,
  `variant_attributes`). Idempotent migration via `ALTER TABLE ADD
  COLUMN`; duplicate-column errors are swallowed so re-runs are
  safe.
- `ProductService` (`create`, `update`, `bulkUpsert`, row mapper)
  all read + write the new columns.
- `ImportService.commit()` now writes the new + Product-Library
  columns into `skus`; previously it only touched the legacy
  label-generation columns.
- `STANDARD_COLUMNS` in `shared/types/import.ts` extended with the
  new canonical names so the column-mapping UI surfaces them.

## [0.5.3] — 2026-05-20

### Changed

- **Donation link switched to the shared Studio-KH hosted page**
  (`https://nowpayments.io/donation/studiokh`) — same URL used by the
  other Studio-KH apps for consistency. Was previously the embed-widget
  URL form with an exposed (public) `api_key`. Same donor UX, just a
  shorter / branded link.

## [0.5.2] — 2026-05-19

Settings tidy-up: only the languages we actually keep up to date, and
a faster way to inspect / open the save folder.

### Added

- **Reveal save location.** The path on the Settings → _Save
  location_ row is now a button — click it (or the new _Reveal_
  ghost button next to it) to open the folder in Finder. No more
  copy-pasting the path into a terminal.

### Changed

- **Languages trimmed to English + Khmer.** The Thai / Korean /
  Chinese / Japanese options were placeholder translations that
  hadn't been kept in sync with new strings. Removed from the
  Settings picker; the underlying `i18n` setup now coerces any
  previously-stored locale (e.g. `'th'`) back to `'en'` on next
  launch so existing users don't see broken UI.

### Removed

- `locales/th.json`, `locales/ko.json`, `locales/zh.json`,
  `locales/ja.json` deleted from the repo. Add a single JSON file
  back + register it in `src/renderer/i18n.ts` if any of these come
  back as real translations.

## [0.5.1] — 2026-05-19

### Changed

- **Default theme is now Light.** Previously the first launch
  followed the OS preference (`prefers-color-scheme`), which would
  silently flip the app to dark on users with a dark Mac — without
  them having opted in. Fresh installs now start in light mode;
  users who explicitly pick Dark or System in Settings still have
  that choice persisted across launches.

## [0.5.0] — 2026-05-19

Brands page rebuilt to match the simpler Image Studio KH reference:
single-page modal for create / edit (no more six-step wizard), and a
card grid that leads with the brand logo. Minor bump because this
replaces a 815-line component and shifts the brand-management UX.

### Added

- **`BrandFormModal`** — one-page form: Name (required), Color (8-
  swatch palette with a gradient last swatch as a flexibility hint),
  Icon upload with live preview, and a folded "Brand details
  (optional)" disclosure for tagline / website / address / phone /
  email / category / customer-care label / established year.
  Defaults to expanded in edit mode when any detail is already
  populated, so users see their data without an extra click.
- **Shared `Modal` shell** at `components/Modal.tsx` per
  AGENTS.md §2: handles Esc-to-close, click-outside-to-close, the
  X corner button (`aria-label="Close (Esc)"`), and auto-focuses the
  first input on open. Every new modal should compose this — no more
  re-implementing the backdrop / Esc dance per file.
- **Per-brand product counts** on the Brands page cards. Single
  `products:countsByBrand(companyId?)` IPC returns a `Record<brandId, count>`
  in one round-trip (was: full `products.list` per brand, which we
  weren't actually doing because the card showed template counts —
  now it shows what the screenshot showed).

### Changed

- **Brand cards now lead with the logo.** Large 80×80 image-tile
  on the left, brand name + "N product(s)" + tagline on the right,
  _Edit_ button at the bottom, _Open templates →_ link, _Delete_
  trash icon top-right on hover. Matches the reference layout.
- Page header now carries a subtitle line ("A company can carry one
  or many brands. Brands have an optional icon shown on product
  cards and exports.") — explains the model at a glance.

### Removed

- **`NewBrandWizard.tsx` (815 lines) deleted.** The six-step flow
  (basic → logo → identity → contact → cert → review) made small
  edits feel heavy and required the user to click through steps
  they didn't care about. Single page is faster for both create
  and edit. Cert-badges editing is dropped from the wizard for now;
  brand assets that already had cert badges keep them on disk and
  in the model — they're just not re-exposed in this form. (Add
  back as another disclosure section if needed.)

## [0.4.4] — 2026-05-19

Sidebar footer reorganised to match the Catalog Studio KH layout.

### Changed

- **Sidebar footer is now three rows instead of two squashed lines.**
  Order from top to bottom:
  1. _What's new_ — full-width row with sparkles icon, opens the
     full-history modal.
  2. _Support this app_ — full-width row with heart icon, navigates
     to /support.
  3. Tiny version line (`v0.4.4`) on its own row at the bottom.

  Previously _What's new_ was crammed next to the version on one
  line; promoting it to its own row makes it discoverable without
  fighting for space.

## [0.4.3] — 2026-05-19

Sidebar and page-header polish to make the active workspace
immediately legible at every level of the app.

### Added

- **App identity in the sidebar.** A small dark-rounded "LS" mark
  sits next to **Label Studio KH** at the top of the sidebar,
  below the macOS traffic-light strip. Built from theme tokens
  (no image dep) so it inverts cleanly in dark mode.
- **Workspace subtitle on the Dashboard page header.** The page now
  reads "Dashboard" with "Workspace for <Company Name>" underneath,
  so you don't have to glance back at the sidebar switcher to know
  which company's numbers you're looking at. The shared `Page`
  component picked up an optional `subtitle` prop; other pages can
  use it the same way when relevant.

### Changed

- **Nav order: Company is now above Dashboard.** Workspace scope is
  the broadest mental model ("which workspace?") and now sits at the
  top of the SETUP group. Dashboard follows as the in-workspace
  overview, then Brands.
- Page headers grew slightly (`h-12` → `h-14`) to fit the new
  subtitle line without crowding the title.

## [0.4.2] — 2026-05-19

Custom Product Fields are now editable. Companies can define up to
10 free-text fields (Material, Origin, Warranty, …); ProductForm
renders one input per defined field so the data actually flows
through to per-product values.

### Added

- **Custom product fields editor on /company.** Mirrors the price-
  groups section's pattern: add/remove rows, helper text ("Up to 10
  free-text fields available on every product. N / 10."), an Add
  field button that disables at the cap, and an empty state. Save
  trims, drops blanks, and dedupes by name (case-insensitive) before
  persisting.
- **ProductForm renders the active company's custom fields.** One
  input per definition, slotted between Prices and Images. Values
  land in `product.customFields[name]`; clearing an input removes
  the key so the row doesn't carry stale blanks.

### Internal

- ProductForm's `makeEmptyForm` + edit-init now seed `customFields`
  so the form state has a stable shape (no `undefined` reads in the
  update helper).

## [0.4.1] — 2026-05-19

A focused bug-fix release that surfaces product deletion as a first-
class action on the table + grid. Establishes a new release cadence:
every bug fix or change bumps the version and gets its own DMG.

### Added

- **Row-level delete on the Product Library.** The table's last
  column now has explicit pencil (Edit) and trash (Delete) icon
  buttons. Grid cards show a trash icon top-right on hover.
- **Page-level delete confirmation** spells out exactly what
  happens — "Permanently removes \<SKU\> from the product database" —
  and warns that re-importing the same CSV will recreate the row.
  This addresses confusion about deletes "coming back": the delete
  was always a hard `DELETE FROM skus`; subsequent re-imports were
  re-creating the rows via bulkUpsert.

### Internal

- New durable rule in `AGENTS.md` §20: bump version + rebuild DMG
  after every change. Avoids ambiguous testing where multiple fixes
  ride under the same version on disk.

## [0.4.0] — 2026-05-19

Three long-standing UX gaps closed: element **rotation** in the template
designer, **background generation** with a proper Jobs page so the app
stays usable while a batch is running, and **per-element alignment
controls** that were missing from the Text properties panel.

### Added

- **Element rotation in the designer.** Every template element has a
  new optional `rotation` field (degrees, clockwise, around its
  centre). Use the Properties panel's _Rotation (°)_ input or the
  quick-action buttons (−90° / 0° / +90°). The export pipeline
  applies the same CSS transform so the generated PDF/PNG matches
  the canvas exactly. Resize handles stay axis-aligned (operate in
  the element's AABB), which is fine for the common "stamp text at
  45°" case — proper rotated-handle math is a future polish.
- **Background generation + Jobs page.** Kicking off a generation no
  longer pops a blocking modal. A small status banner stays on the
  Generate page while the job runs in the background — you can
  navigate to Templates, Products, or anywhere else and the batch
  keeps going. New `/jobs` page (sidebar entry: _Jobs_) shows:
  - Active in-memory jobs with a live progress bar + cancel button.
  - This-session finished jobs with "Open folder" / dismiss actions.
  - **History**: every batch ever generated for the active company,
    pulled from the existing `generations` table — when it ran,
    brand, sizes/formats, SKU + file counts, total size on disk.
- **Sidebar live badge.** The _Jobs_ row shows a number when one or
  more generations are running, so you always know there's work
  in flight.
- **OS notifications.** When a generation finishes while the app is
  in the background, a native notification fires (in addition to
  the in-app toast). No-op if the app is focused.
- **Alignment controls in element properties.** Text elements now
  have **horizontal align** (left/center/right) — previously missing
  from the UI entirely despite the data model supporting it — and
  vertical align (top/middle/bottom) is now always visible, not
  hidden behind the multi-line toggle. Price / Country / Date
  panels use the same three-button segmented icon control for
  visual consistency.

### Removed

- **The bundled "Demo brand" is gone.** It used to be a hidden-but-not-
  deletable record that cluttered brand pickers and required a separate
  _Hide demo brand_ toggle in Settings. On first launch of 0.4.0 the
  app runs a one-time purge that removes:
  - the demo brand from `brands.json` (plus strips the dead `isDemo`
    field from any remaining brand)
  - all template + asset files under the demo brand's directories
  - SKU + generation rows in the database that referenced the demo
    brand
  - the seeded `demo-products.csv` from the user-data folder
  - the _Hide demo brand_ Settings row, the demo first-launch hint
    on the Brands page, and the "Try the sample" button in Import

  Fresh installs never see any of this. Existing users get a clean
  workspace automatically.

### Changed

- _Generate_ button changes its label to "Generating in background —
  N/M" while a job is in flight; you can leave the page freely.
- **"What's new" modal now shows full history when opened manually.**
  Clicking the footer _What's new_ button always renders every
  changelog entry (scrollable) instead of only entries newer than
  the last-seen version — so you can look back any time, not just
  once after an update. The auto-open on a fresh launch still
  surfaces only the diff so it doesn't overwhelm.
- Toast on completion now includes an _Open folder_ action that
  reveals the output directory.
- `generations:listBatches(companyId, limit?)` IPC added for the
  history view; thin wrapper around a GROUP BY query, scoped to the
  active company (mirrors the rest of the app).

### Internal

- New `useJobsStore` (Zustand) owns the lifecycle of bulk exports
  end-to-end — kickoff, progress, completion toast, OS notification,
  and cleanup of the IPC progress listener. Generate.tsx is now a
  thin dispatcher.
- `BaseElement.rotation` (degrees) optional; `normalizeRotation()`
  helper canonicalises to `(-180, 180]` and drops zero so old
  templates JSON-diff cleanly.

## [0.3.0] — 2026-05-19

A major release covering the Product Library, the Company → Brand →
Product hierarchy, a rewritten File Manager, and a round of audit-
driven fixes. Schema migrates from v3 to v6 on first launch (additive
ALTER TABLE only; existing data is preserved and backfilled).

### Added

- **Product Library** at `/products` — full CRUD over your SKU
  catalogue with table + grid views, brand + category sidebar
  filters, search across SKU / name / colour / tags / barcode /
  secondary code, pagination (25 / 50 / 100 / 200 per page), and an
  edit modal covering the canonical fields plus per-company price
  groups. Integrated tabs: **Library** (the table/grid) ·
  **Import** (the 3-step CSV/Excel flow, moved from /data) ·
  **History** (past imports).
- **Multi-image gallery per product.** Up to 20 images per product
  with set-as-main, reorder, remove, paste-from-clipboard (⌘V),
  and a content-hash dedup pipeline. Same file imported twice
  collapses on disk and in the product's image array.
- **Auto-match images from a folder.** Drop a folder of product
  photos named by SKU (or with `-1`/`-2` suffixes, or in per-SKU
  subfolders) and the app attaches them to matching products with
  one click. Recursive 5-level scan, case-insensitive matching,
  20-image cap enforced, full stats panel on completion.
- **Company entity** as the parent of Brand. Workspace switcher
  chip at the top of the sidebar lets you flip between companies;
  brands, products, templates, and files all scope to the active
  company. Manage at the new `/company` page — edit name, contact
  info, colour swatch, and the per-company **price groups** list
  (e.g. `Retail`, `Wholesale`, `VIP`). Product form's prices
  section reads from this list dynamically.
- **File Manager overhaul.** Now matches the Product Library
  layout: sidebar filters (Brand · Format · Size), storage stats
  card at the top (totals + per-format breakdown), Table / Grid
  view toggle, and an "Open product" action on every row that
  jumps to the product that generated the file.
- **Click-through from file → product.** SKU column in the file
  table and the package-icon action in both views deep-link to
  `/products?edit=<productId>` and open the edit modal directly.

### Changed

- **Sidebar restructured.** SETUP now lists Dashboard · Company ·
  Brands. PRODUCTION lists Product Library · Templates · Generate
  · Barcode generator · Files. (Templates and Product Library
  moved from SETUP into PRODUCTION.)
- **Dashboard, Brands, Templates, Generate, Barcodes, File
  Manager** are all now scoped to the active company. Brand
  pickers no longer leak across workspaces. Dashboard stats
  (brand count, SKU count, generated total) reflect only the
  active company.

### Fixed

- Edit modal on `/products` now opens even when no specific brand
  is selected as the sidebar filter (previously the modal silently
  refused to render unless a brand was active).
- DB migration ordering bug: v4+ indexes (`idx_skus_id`,
  `idx_skus_category`, `idx_skus_company`, `idx_generations_company`)
  previously lived in the SCHEMA constant and failed on upgraded
  databases because the columns hadn't been created yet. Moved to
  a post-migration block that runs after all `ALTER TABLE` steps
  settle.
- `CompanyService.ensureBootstrap` no longer rewrites
  soft-deleted brands when backfilling `companyId` — they're left
  alone for the next purge cycle.

## [0.2.8] — 2026-05-11

### Removed

- **Direct-send wallet rows on the Donate page.** NOWPayments' widget
  already gives donors a polished coin/network picker over 200+ assets,
  and per-coin direct-send addresses were never enabled (still placeholder
  rows in 0.2.7). Dropped the `WALLETS` array, `WalletRow` component, QR
  rendering, copy-button, and clipboard plumbing — about 100 lines.
  Restore from commit `8b7be4a` if direct-send is ever wanted back.

### Changed

- **Support → Donate page simplified to a single button** + the headline
  card. Cleaner code, cleaner UI. NOWPayments handles everything on the
  donor side.

## [0.2.7] — 2026-05-11

### Added

- **NOWPayments donation link is now live.** The "Pay with crypto
  (NOWPayments)" button on Support → Donate opens the real donation
  widget in the user's default browser. Wallet rows for direct sends
  still show the "Donations are being set up" placeholder until the
  wallet addresses are provided — to be filled in a follow-up edit to
  the `WALLETS` array at the top of `src/renderer/pages/Support.tsx`.

## [0.2.6] — 2026-05-11

### Removed

- **Licensing feature retired.** The license-key activation flow,
  `LicenseService`, `licenseStore`, the `Licensed` sidebar badge, the
  license type definitions, the IPC handlers, and the
  `scripts/generate-license.mjs` key generator are all gone — roughly
  200 lines deleted. Existing `license.json` files in `userData/` are
  inert and harmless (nothing reads them anymore). The
  `LICENSE_SECRET` env var is no longer needed.

### Changed

- **Support page is now the Donate page.** Title changes to "Support
  development". The headline card stays ("free, with all features
  unlocked, donations are optional"), and the License-key card is
  replaced with a Donate card — see below.
- **Dashboard donation nudge no longer gates on license state.** The
  nudge shows by default, can be dismissed for 7 days, and the button
  now reads "Donate" (was "Learn more"). Same dismissal cookie
  (`lskh.donationDismissedAt`).

### Added

- **Donate card on /support.** Slot for a NOWPayments donation widget
  button (opens the user's NOWPayments donation page in the default
  browser via Electron's setWindowOpenHandler), plus an expandable
  "Or send directly to a wallet" section with one row per supported
  chain (BTC / ETH / USDT-TRC20 by default), showing a live QR code
  rendered with the existing `qrcode` library, the full address with
  click-to-copy, and a chain/network label. Currently ships with
  `TODO_` placeholder constants at the top of
  `src/renderer/pages/Support.tsx`; wallet rows whose address still
  matches the placeholder are hidden automatically, and if every
  payment method is unconfigured the card shows a polite "donations
  are being set up" placeholder instead of broken buttons. Filling
  in the real NOWPayments URL + addresses is a one-edit change at
  the top of that file — no other code needs to change.

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
