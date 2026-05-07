# IPC Channels

Per spec §13, every IPC channel between the renderer and main process is documented somewhere obvious so future REST/CLI wrapping is straightforward — the channel name + payload shape define the API.

## Source of truth

The TypeScript `Api` type exported from [`../../preload/index.ts`](../../preload/index.ts) **is** the documented IPC surface. Each method on that object corresponds to exactly one `ipcMain.handle('...', ...)` call in this folder. The JSDoc and parameter types on the preload methods are kept up to date because they're consumed by every renderer-side call site.

## Conventions

- **Channel naming**: `{domain}:{action}` — e.g. `brand:list`, `template:save`, `export:bulk`. Domain matches the file in this folder (`brand.ts` exports handlers under `brand:*`).
- **Payloads**: plain JSON-serialisable objects (no functions, no class instances, no Buffers).
- **Errors**: throw from the handler; the renderer's `await ipcRenderer.invoke(...)` rejects with the message. Renderer-side stores already wrap calls in try/catch where surfacing matters.
- **Streaming progress**: where a single call produces incremental updates (e.g. `export:bulk`), the main process emits `webContents.send('export:progress:<runId>', info)` events keyed by a per-run id, and the preload exposes an `onProgress(runId, cb)` helper that returns an unsubscribe function.

## Domain index

| File | Domain | What it covers |
|---|---|---|
| `app.ts` | `app:*` | Diagnostic queries (version, etc.) |
| `brand.ts` | `brand:*` | CRUD for brands.json + asset import/remove |
| `template.ts` | `template:*` | CRUD for template JSON files |
| `import.ts` | `import:*` | Parse, auto-map, validate, dedup, commit, list SKUs/imports |
| `export.ts` | `export:*` | Single + bulk PDF/PNG/JPEG export, folder picker, OS reveal |
| `file.ts` | `file:*` | List/filter/delete/reprint generated files |
| `dashboard.ts` | `dashboard:*` | Live stats, recent brands, recent activity |
| `settings.ts` | `settings:*` | Read/write app-level settings JSON |
| `license.ts` | `license:*` | License status / activate / deactivate |
| `sku.ts` | `sku:*` | Single-SKU CRUD (manual entry) |
| `dialog.ts` | `dialog:*` | Native file pickers (image, images) |
