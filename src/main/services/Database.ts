import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

let _db: Database.Database | null = null;

const SCHEMA_VERSION = 4;

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

  PRIMARY KEY (sku, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_skus_brand    ON skus(brand_id);
CREATE INDEX IF NOT EXISTS idx_skus_sku      ON skus(sku);
CREATE INDEX IF NOT EXISTS idx_skus_id       ON skus(id);
CREATE INDEX IF NOT EXISTS idx_skus_category ON skus(brand_id, category);

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

    // Indexes added in v4 (CREATE INDEX IF NOT EXISTS is itself idempotent).
    _db.exec('CREATE INDEX IF NOT EXISTS idx_skus_id ON skus(id)');
    _db.exec('CREATE INDEX IF NOT EXISTS idx_skus_category ON skus(brand_id, category)');

    _db
      .prepare('UPDATE schema_meta SET value = ? WHERE key = ?')
      .run('4', 'version');
  }

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
