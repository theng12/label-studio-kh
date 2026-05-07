import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

let _db: Database.Database | null = null;

const SCHEMA_VERSION = 2;

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
CREATE TABLE IF NOT EXISTS skus (
  sku                 TEXT NOT NULL,
  brand_id            TEXT NOT NULL,
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
  PRIMARY KEY (sku, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_skus_brand ON skus(brand_id);
CREATE INDEX IF NOT EXISTS idx_skus_sku ON skus(sku);

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
  created_at   TEXT NOT NULL
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
  }

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
