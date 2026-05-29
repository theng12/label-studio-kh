# Label Studio KH — Roadmap

> Working doc for planning + cross-session handoff. When you spawn a fresh
> Claude Code session to tackle an item, point it at this file + `AGENTS.md`
> + the relevant `_Core Docs/*_HANDOFF.md`. Update the Status column as
> things land.
>
> Conventions: every code change bumps `package.json` + adds a `CHANGELOG.md`
> entry + rebuilds the arm64 DMG (`npm run build:mac:arm64`). See AGENTS.md §20.
>
> Last updated: 2026-05-29 (current app version: 0.11.0).

---

## Status legend

- ✅ Done — shipped in a released DMG
- 🚧 In progress — partially built
- ⬜ Planned — speced here, not started
- 💭 Idea — needs more thought / a decision before building

---

## Printing hub (the #1 strategic route)

The app's biggest category gap was that it designed + exported labels but
couldn't *print*. This route closes that.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | **Direct OS printing** | ✅ 0.10.0 | Print to any OS printer incl. thermal/roll (Zebra/Dymo/Brother/Xprinter) via `webContents.print()`. Printer picker + copies + silent/dialog. One label per page. |
| 2 | **N-up sheet layouts** | ✅ 0.11.0 | Tile labels on A4/Letter for office sheet printers. Page size / orientation / margin / gap with live "X per page" + auto-fit grid. Plus "Export sheet PDF" (one combined PDF). |
| 3 | **Raw ZPL/EPL output** | ⬜ Planned | Native Zebra/thermal code for users who want it over the OS driver. Lowest priority — OS printing already covers Zebra. **Hard part:** mapping visual template elements → ZPL commands (`^FO`/`^FD`/`^BC`/`^GFA` for images). Probably only worth it for pure-text/barcode labels; raster fallback (`^GFA`) for anything with images/logos. Scope per-element: text→`^A`/`^FD`, barcode→`^BC`/`^BQ`, rect→`^GB`, image→`^GFA` raster. New `ZplRenderer.ts` mirroring `StickerRenderer.ts`. Add a "ZPL" output option + a preview/copy-to-clipboard.

### Key files for the printing hub
- `src/main/services/PrintService.ts` — print dispatch + printer enumeration
- `src/main/services/StickerRenderer.ts` — `renderLabelsForPrint()` (roll), `renderSheet()` (N-up)
- `src/main/services/ExportService.ts` — `exportSheetPdf()`
- `src/shared/sheetLayout.ts` — grid math (shared renderer/main)
- `src/renderer/pages/Generate.tsx` — the Print panel + `SheetControls`
- IPC: `src/main/ipc/print.ts`, `src/main/ipc/export.ts`

### ZPL nice-to-haves once #3 exists
- Avery / Zebra label-stock presets (named sizes that set template W/H + sheet config in one pick).
- Print-time serialization counters (`^SN` in ZPL; a render-time counter for the HTML path).

---

## Data safety & portability

| Item | Status | Notes |
|---|---|---|
| **Product data export** (→ CSV/Excel) | ⬜ Planned | Import is one-way today. Add `export:productsToWorkbook(companyId, brandId?)` → SheetJS write, mirroring the sample-sheet columns. Round-trips with the importer. **Files:** new `ExportProductsService` or extend `ImportService`; button on Product Library toolbar. |
| **Backup / restore whole workspace** | ⬜ Planned (high value) | Local-first app with no cloud → a dead Mac = total data loss. Add "Export backup" = zip of `label-studio-kh.db` + `brands.json` + `companies.json` + `settings.json` + `assets/` + `templates/`. "Restore backup" = unzip + relaunch. **Files:** new `BackupService.ts` (uses `node:zlib`/a zip lib or `tar`), IPC, Settings page buttons. Prompt + `app.relaunch()` after restore. |

---

## Catalog / PIM depth

| Item | Status | Notes |
|---|---|---|
| **Bulk edit** | ⬜ Planned | Multi-select products → edit a field (status / category / brand / a price group) across all. Image Studio KH has `BulkEditModal.jsx` to mirror. **Files:** Product Library multi-select state (already a pattern in Image Studio), new `BulkEditModal`, `products:bulkUpdate` IPC. Remember to audit-log it (`bulk-update`). |
| **Variant matrix** | ⬜ Planned | `variant_attributes` is free-text today. Add a real size×color matrix that fans out into child SKUs/labels. **Decision needed:** are variants separate products or a structured field on one product? Affects schema. |
| **Inventory actuation** | 💭 Idea | The fields (reorder point/qty, track inventory, tax rate) are stored but inert. Could add low-stock badges, a "needs reorder" filter, tax-inclusive price display. **Risk:** drifts toward being an inventory/ERP app — confirm that's wanted before building. |
| **Barcode lookup / scan-to-find** | 💭 Idea | Type/scan a barcode → jump to the product. Cheap + useful for retail. |

---

## Barcode symbologies

| Item | Status | Notes |
|---|---|---|
| **More symbologies** | ⬜ Planned | Today: EAN-13, Code128, Code39, UPC-A. Add **DataMatrix, GS1-128, ITF-14, PDF417** (retail/logistics staples), maybe Codabar/Aztec. **Files:** `BarcodeService.ts` + `StickerRenderer.ts` barcode element + the barcode element type union in `shared/types/template.ts` + the barcode property panel. `jsbarcode` covers most 1D; DataMatrix/PDF417/Aztec need another lib (e.g. `bwip-js` — would replace/augment jsbarcode). |
| **GS1 application identifiers** | 💭 Idea | Proper GS1-128 with AIs (01, 17, 10, …) for retail compliance. Builds on GS1-128 above. |

---

## Onboarding & UX

| Item | Status | Notes |
|---|---|---|
| **First-run onboarding** | ⬜ Planned | The demo brand was removed (0.4.0) with nothing to replace it — a fresh user lands in an empty app. Add a lightweight first-run guide: create a company → add a brand → import or add a product → design a template → generate. Could be a dismissable checklist on the Dashboard. |
| **Conditional element visibility** | 💭 Idea | Show/hide a template element based on whether a data field has a value (e.g. hide the "Sale" badge when there's no sale price). A power-user label feature. **Files:** element type gets a `visibleWhen` rule; `StickerRenderer` honors it. |

---

## Strategic / bigger bets (need a decision first)

| Item | Status | Notes |
|---|---|---|
| **App-family consolidation** | 💭 Decision | Label / Image / Catalog Studio KH share Company→Brand→Product. Decide: separate apps that sync, OR one shell with switchable modules, OR one hub + plugins. Shapes everything below. |
| **Cloud / team sync** | 💭 Decision | Image Studio KH has a "client mode" hinting at a server backend in the family. A shared workspace → teams + multi-device + automatic backup in one move (also solves the backup gap). Big infra commitment. |
| **POS / e-commerce integrations** | 💭 Idea | Cambodian SMBs use Loyverse etc. Pull product data from a POS instead of CSV round-trips. Strong wedge if the family goes commercial. |
| **AI assist** | 💭 Idea | Mirror the family's AI investment (Image Studio's AI/Overlay Studio). For labels: en↔km auto-translation of label text, smart CSV column mapping, "generate a label layout from a product." |
| **Template marketplace** | 💭 Idea | Pre-built label templates for common KH categories (cosmetics, food, hardware, pharma). Showcases the Khmer-typography advantage, lowers the empty-canvas barrier. |

---

## Where we already exceed the field (don't regress these)

- Khmer + multi-script rendering via bundled Noto + Chromium (the core moat).
- Free + local-first + no licensing.
- Content-addressed image dedup + smart filename auto-match.
- Background generation with a Jobs queue + OS notifications.
- Audit log / History (0.9.0).
- Per-company price groups + custom fields; Company→Brand→Product hierarchy.
- Modern UX (sidebar, docked side panels, theme, i18n).

---

## Suggested next-session order

If picking up cold, highest impact-to-effort first:

1. **Backup / restore** — protects users from data loss; self-contained; no UX research needed.
2. **Product data export** — small, completes the import/export round-trip.
3. **Bulk edit** — clear pattern to copy from Image Studio KH; high daily-use value.
4. **More barcode symbologies** — credibility with retail/logistics; mostly a `bwip-js` integration.
5. **First-run onboarding** — improves activation for new users.
6. **ZPL output** (printing hub #3) — only if users with Zebra printers ask; OS printing already covers them.
7. Strategic bets (consolidation / cloud / POS / AI / marketplace) — need a product decision before code.
