// Product image storage layer. Mirrors docs/PRODUCT_LIBRARY_HANDOFF.md §8
// adapted to our app:
//   - We skip sharp (no resize/recompress) for now to keep CI simple. Same
//     file bytes → same hash → same on-disk filename, so dedup still works.
//     Adding sharp is a future optimization for users with large phone
//     photos; the storage layout stays compatible.
//   - Assets live under `<userData>/assets/products/`. The DB stores the
//     relative path (e.g. "products/shelf-001-a1b2c3.jpg"). The renderer
//     resolves these to lskh-file:// URLs at display time.

import { app } from 'electron';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  mkdtempSync,
} from 'node:fs';
import { extname, join, basename } from 'node:path';
import { tmpdir } from 'node:os';

const HASH_PREFIX_LEN = 10;
const SLUG_MAX_LEN = 60;

/** Recognised raster extensions. SVG is allowed and copied as-is — sharp
 *  isn't in play here, but SVG is just a text file so size isn't an issue. */
const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

/** Lowercase, hyphenated, truncated. Used as the human-readable prefix on
 *  on-disk filenames so a folder listing is browseable. The hash suffix is
 *  what guarantees uniqueness; the slug is just for human comprehension. */
export function slugify(input: string | null | undefined, fallback = 'asset'): string {
  const s = String(input ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LEN);
  return s || fallback;
}

/** SHA-1 of the source file's bytes. Async because images can be tens of MB
 *  and we don't want to block the event loop. */
function sha1Hex(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha1');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function getProductAssetsDir(): string {
  const dir = join(app.getPath('userData'), 'assets', 'products');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Where the entire assets root lives. Used by the renderer URL helper.
 *  Exposed via the `app:getAssetsDir` IPC. */
export function getAssetsRootDir(): string {
  const dir = join(app.getPath('userData'), 'assets');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

interface ImportResult {
  /** Relative path from the assets root, e.g. "products/shelf-001-a1b2c3.jpg".
   *  This is what gets stored in the Product.images array. */
  relativePath: string;
  /** Absolute path on disk — handy for callers that want to verify or open. */
  absolutePath: string;
  /** True if a file with this hash was already on disk and we reused it. */
  skipped: boolean;
}

/** Copy a file into the product assets folder. The destination filename is
 *  `<slug>-<10char-sha1>.<ext>` so duplicate-by-content imports collapse
 *  onto the same on-disk file. Returns the relative path to store in the DB. */
export async function importProductImageFromPath(
  sourcePath: string,
  slugHint: string,
): Promise<ImportResult> {
  if (!sourcePath || !existsSync(sourcePath)) {
    throw new Error(`Source image not found: ${sourcePath}`);
  }
  const ext = extname(sourcePath).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    throw new Error(
      `Unsupported image type "${ext}". Allowed: ${[...ALLOWED_EXTS].join(', ')}`,
    );
  }

  const hashFull = await sha1Hex(sourcePath);
  const hash = hashFull.slice(0, HASH_PREFIX_LEN);
  const fileName = `${slugify(slugHint, 'product')}-${hash}${ext}`;
  const destDir = getProductAssetsDir();
  const destAbs = join(destDir, fileName);
  const relativePath = `products/${fileName}`;

  if (existsSync(destAbs)) {
    return { relativePath, absolutePath: destAbs, skipped: true };
  }
  copyFileSync(sourcePath, destAbs);
  return { relativePath, absolutePath: destAbs, skipped: false };
}

/** Clipboard-paste path. Writes the bytes to a temp file, then funnels
 *  through `importProductImageFromPath` so dedup applies. The temp file is
 *  cleaned up in `finally`. */
export async function importProductImageFromBytes(
  bytes: ArrayBuffer | Uint8Array,
  ext: string,
  slugHint: string,
): Promise<ImportResult> {
  const safeExt =
    ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  if (!ALLOWED_EXTS.has(safeExt)) {
    throw new Error(`Unsupported pasted image type: ${safeExt}`);
  }
  const tmpDir = mkdtempSync(join(tmpdir(), 'lskh-paste-'));
  const tmpPath = join(tmpDir, `paste${safeExt}`);
  try {
    const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    writeFileSync(tmpPath, buf);
    return await importProductImageFromPath(tmpPath, slugHint);
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup; not fatal if it fails
    }
  }
}

/** Helper for the renderer URL builder — given a relative path like
 *  "products/shelf-001-a1b2c3.jpg", returns the absolute path. Used by
 *  the `app:getAssetsDir` IPC consumer. */
export function resolveProductImagePath(relativePath: string): string {
  const root = getAssetsRootDir();
  return join(root, relativePath);
}

/** Filename helper for callers that want to display just the basename. */
export function imageFileName(relativePath: string): string {
  return basename(relativePath);
}
