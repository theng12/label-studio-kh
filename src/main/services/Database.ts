import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

let _db: Database.Database | null = null;

const SCHEMA_VERSION = 7;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS imports (
  id              TEXT PRIMARY KEY,
  source_filename TEXT,
  brand_id        TEXT,
  row_count       INTEGER NOT NULL,
  warnings_count  INTEGER NOT NULL DEFAULT 0,
  errors_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);

-- A SKU is unique within a brand. Same SKU can exist under different brands.
-- The (sku, brand_id) composite is the natural key. 'id' is a UUID added in
-- v4 for IPC ergonomics — new Product Library code passes products around by
-- id; legacy paths (ImportService, generations table) still use the composite.
CREATE TABLE IF NOT EXISTS skus (
  -- Identity
  id                  TEXT,              -- UUID v4. Populated by v4 backfill for legacy rows.
  sku                 TEXT NOT NULL,
  brand_id            TEXT NOT NULL,

  -- Legacy fields (kept for backward compat with ImportService + Generate)
  product_name        TEXT,
  barcode             TEXT,
  description         TEXT,
  variant             TEXT,
  unit_qty            TEXT,
  unit_word           TEXT,
  product_url         TEXT,
  product_image_path  TEXT,
  date                TEXT,
  notes               TEXT,
  extra_json          TEXT,
  last_import_id      TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,

  -- v4: Product Library extensions
  secondary_code      TEXT,
  category            TEXT,
  subcategory         TEXT,
  color_finish        TEXT,
  unit                TEXT,
  images              TEXT NOT NULL DEFAULT '[]',  -- JSON array of relative asset paths
  prices              TEXT NOT NULL DEFAULT '{}',  -- JSON map: { "Retail": 25, "Wholesale": 18 }
  tags                TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
  custom_fields       TEXT NOT NULL DEFAULT '{}',  -- JSON map of user-defined columns
  status              TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive' | 'draft'

  -- v5: parent Company. Denormalized from brands.json for direct
  -- WHERE company_id = ? filtering. Populated by the v4→v5 bootstrap
  -- and on every new product insert via the brand → company mapping.
  company_id          TEXT,

  -- v7: Inventory & lifecycle columns. Added so the CSV column set
  -- matches the user's external inventory/POS system. Label Studio
  -- itself doesn't act on these — they're round-trip data.
  expiry_date         TEXT,
  tax_rate            TEXT,
  reorder_point       TEXT,
  reorder_quantity    TEXT,
  track_inventory     INTEGER NOT NULL DEFAULT 0,  -- SQLite boolean (0/1)
  variant_attributes  TEXT,

  PRIMARY KEY (sku, brand_id)
);

-- Only indexes that reference v3 columns can live here, because this
-- SCHEMA block runs BEFORE the v3→v4 migration on upgraded DBs (the
-- migration is what adds id / category / company_id). Indexes on those
-- columns are created at the bottom of getDb() after migrations settle.
CREATE INDEX IF NOT EXISTS idx_skus_brand ON skus(brand_id);
CREATE INDEX IF NOT EXISTS idx_skus_sku   ON skus(sku);

CREATE TABLE IF NOT EXISTS batches (
  id            TEXT PRIMARY KEY,
  brand_id      TEXT NOT NULL,
  template_id   TEXT NOT NULL,
  total_count   INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  completed_at  TEXT
);

CREATE TABLE IF NOT EXISTS generations (
  id           TEXT PRIMARY KEY,
  batch_id     TEXT,
  sku          TEXT NOT NULL,
  brand_id     TEXT NOT NULL,
  -- v6: denormalized parent company for direct WHERE company_id = ?
  -- filtering in File Manager. Populated by the v5→v6 backfill
  -- (CompanyService.ensureBootstrap) and on every new generation
  -- insert via ExportService.
  company_id   TEXT,
  template_id  TEXT NOT NULL,
  format       TEXT NOT NULL,
  dpi          INTEGER NOT NULL,
  size_label   TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  file_size    INTEGER,
  template_snapshot TEXT,
  data_snapshot     TEXT,
  brand_snapshot    TEXT,
  created_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_generations_sku ON generations(sku);
CREATE INDEX IF NOT EXISTS idx_generations_brand ON generations(brand_id);
CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at);
-- idx_generations_company is created in the post-migration block at the
-- bottom of getDb() so it also applies to upgraded DBs whose ALTER TABLE
-- adds the column at boot.

-- Audit log — immutable, queryable history of every mutation (product
-- create/update/delete, image add/remove/set-main/reorder, …). Mirrors
-- the Image Studio KH model but single-user (no user_id) and company-
-- scoped. before_json / after_json carry ONLY the changed keys on an
-- update (tiny payloads), or a full snapshot on create/delete. CREATE
-- TABLE IF NOT EXISTS means upgraded DBs pick this up on next boot with
-- no schema-version bump needed.
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,   -- 'product' | 'image' | 'brand' | 'company' | …
  entity_id   TEXT,            -- product/brand id; product_id for image events
  company_id  TEXT,            -- workspace scope for the global History page
  action      TEXT NOT NULL,   -- 'create' | 'update' | 'delete' | 'image:add' | …
  summary     TEXT,            -- human-readable one-liner for the feed
  before_json TEXT,            -- changed keys' old values (update) / snapshot (delete)
  after_json  TEXT,            -- changed keys' new values (update) / snapshot (create)
  created_at  TEXT NOT NULL    -- ISO 8601
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_log(company_id);
`;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = join(app.getPath('userData'));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, 'label-studio-kh.db');
  _db = new Database(file);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(SCHEMA);

  const row = _db
    .prepare('SELECT value FROM schema_meta WHERE key = ?')
    .get('version') as { value: string } | undefined;
  if (!row) {
    _db
      .prepare('INSERT INTO schema_meta(key, value) VALUES (?, ?)')
      .run('version', String(SCHEMA_VERSION));
  } else if (row.value === '1') {
    // v1 → v2: add brand_snapshot column so reprints reproduce the brand state
    // (logo / address / cert badges) at generation time, not the live brand.
    try {
      _db.exec('ALTER TABLE generations ADD COLUMN brand_snapshot TEXT');
    } catch (e) {
      // Idempotent: ignore "duplicate column name" if migration partially ran.
      if (!String(e).includes('duplicate column name')) throw e;
    }
    _db
      .prepare('UPDATE schema_meta SET value = ? WHERE key = ?')
      .run('2', 'version');
    row.value = '2';
  }
  if (row?.value === '2') {
    // v2 → v3: deleted_at column for soft-delete + undo in File Manager.
    try {
      _db.exec('ALTER TABLE generations ADD COLUMN deleted_at TEXT');
    } catch (e) {
      if (!String(e).includes('duplicate column name')) throw e;
    }
    _db
      .prepare('UPDATE schema_meta SET value = ? WHERE key = ?')
      .run('3', 'version');
    if (row) row.value = '3';
  }
  if (row?.value === '3') {
    // v3 → v4: Product Library expansion. Adds UUID `id`, classification
    // fields (category, subcategory, color_finish, unit, secondary_code),
    // JSON-array fields (images, prices, tags, custom_fields), and status.
    // All additive — existing rows keep their data and default to status=
    // 'active', empty arrays, no category, etc.
    //
    // Idempotent via the duplicate-column-name guard, so partial migrations
    // (interrupted boot) replay cleanly.
    const v4Columns: Array<[string, string]> = [
      ['id', 'TEXT'],
      ['secondary_code', 'TEXT'],
      ['category', 'TEXT'],
      ['subcategory', 'TEXT'],
      ['color_finish', 'TEXT'],
      ['unit', 'TEXT'],
      ['images', "TEXT NOT NULL DEFAULT '[]'"],
      ['prices', "TEXT NOT NULL DEFAULT '{}'"],
      ['tags', "TEXT NOT NULL DEFAULT '[]'"],
      ['custom_fields', "TEXT NOT NULL DEFAULT '{}'"],
      ['status', "TEXT NOT NULL DEFAULT 'active'"],
    ];
    for (const [col, type] of v4Columns) {
      try {
        _db.exec(`ALTER TABLE skus ADD COLUMN ${col} ${type}`);
      } catch (e) {
        if (!String(e).includes('duplicate column name')) throw e;
      }
    }

    // Backfill UUID ids for any rows that still have NULL `id`. New rows
    // get their id at insert time in ProductService; this is just for
    // pre-v4 data. Done in a transaction for atomicity.
    const backfill = _db.transaction(() => {
      const rows = _db!
        .prepare('SELECT sku, brand_id FROM skus WHERE id IS NULL')
        .all() as Array<{ sku: string; brand_id: string }>;
      const update = _db!.prepare(
        'UPDATE skus SET id = ? WHERE sku = ? AND brand_id = ?',
      );
      for (const r of rows) update.run(randomUUID(), r.sku, r.brand_id);
    });
    backfill();

    _db
      .prepare('UPDATE schema_meta SET value = ? WHERE key = ?')
      .run('4', 'version');
    if (row) row.value = '4';
  }
  if (row?.value === '4') {
    // v4 → v5: introduce Company as the parent of Brand. company_id is
    // denormalized onto skus for direct WHERE filtering. The actual
    // backfill (creating the default company + populating company_id on
    // both brands.json and existing sku rows) happens in
    // CompanyService.ensureBootstrap() at app start, because it needs
    // to read/write the brands JSON file alongside the DB.
    try {
      _db.exec('ALTER TABLE skus ADD COLUMN company_id TEXT');
    } catch (e) {
      if (!String(e).includes('duplicate column name')) throw e;
    }

    _db
      .prepare('UPDATE schema_meta SET value = ? WHERE key = ?')
      .run('5', 'version');
    if (row) row.value = '5';
  }
  if (row?.value === '5') {
    // v5 → v6: denormalize company_id onto generations so File Manager
    // can WHERE company_id = ? directly instead of two-hop joining
    // through brands.json. Backfill happens in
    // CompanyService.ensureBootstrap (same place we filled skus).
    try {
      _db.exec('ALTER TABLE generations ADD COLUMN company_id TEXT');
    } catch (e) {
      if (!String(e).includes('duplicate column name')) throw e;
    }
    _db
      .prepare('UPDATE schema_meta SET value = ? WHERE key = ?')
      .run('6', 'version');
    if (row) row.value = '6';
  }
  if (row?.value === '6') {
    // v6 → v7: add inventory / lifecycle columns to skus. The CSV column
    // set the user wants to round-trip includes Expiry Date, Tax Rate,
    // Reorder Point/Quantity, Track Inventory, Variant Attributes. We
    // store them as free text (booleans as 0/1) and don't act on them
    // ourselves — Label Studio is a label-design app, not an inventory
    // system. All columns added idempotently so a re-run is a no-op.
    const v7Columns: Array<[string, string]> = [
      ['expiry_date', 'TEXT'],
      ['tax_rate', 'TEXT'],
      ['reorder_point', 'TEXT'],
      ['reorder_quantity', 'TEXT'],
      ['track_inventory', 'INTEGER NOT NULL DEFAULT 0'],
      ['variant_attributes', 'TEXT'],
    ];
    for (const [col, type] of v7Columns) {
      try {
        _db.exec(`ALTER TABLE skus ADD COLUMN ${col} ${type}`);
      } catch (e) {
        if (!String(e).includes('duplicate column name')) throw e;
      }
    }
    _db
      .prepare('UPDATE schema_meta SET value = ? WHERE key = ?')
      .run('7', 'version');
  }

  // Indexes that reference v4+ columns. Created here, after all migrations
  // have settled, so they apply to both fresh installs (columns just got
  // created by CREATE TABLE) and upgrades (columns just got created by
  // ALTER TABLE in the migration blocks above). Putting these in the
  // initial SCHEMA block was the bug that pinned an upgraded DB at v3:
  // CREATE INDEX on a not-yet-existing column threw before the migration
  // could even start. CREATE INDEX IF NOT EXISTS is itself idempotent.
  _db.exec('CREATE INDEX IF NOT EXISTS idx_skus_id ON skus(id)');
  _db.exec('CREATE INDEX IF NOT EXISTS idx_skus_category ON skus(brand_id, category)');
  _db.exec('CREATE INDEX IF NOT EXISTS idx_skus_company ON skus(company_id)');
  _db.exec('CREATE INDEX IF NOT EXISTS idx_generations_company ON generations(company_id)');

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
