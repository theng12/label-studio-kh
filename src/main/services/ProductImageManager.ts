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
import { createReadStream, readdirSync } from 'node:fs';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  mkdtempSync,
} from 'node:fs';
import { extname, join, basename, dirname, resolve } from 'node:path';
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

// ── Smart filename matcher for auto-match flow (spec §9) ─────────────────────

const SCAN_MAX_DEPTH = 5;
const SCAN_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

/** Recursively list image files under `rootPath`, up to `maxDepth` levels
 *  deep. Skips dotfiles and dot-folders. Returns absolute paths. */
export function scanImagesRecursive(
  rootPath: string,
  maxDepth: number = SCAN_MAX_DEPTH,
): string[] {
  const out: string[] = [];
  if (!rootPath || !existsSync(rootPath)) return out;
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    // Type-narrow to the string-name Dirent variant. Without the explicit
    // encoding the TS union picks up the Buffer overload too, which makes
    // `entry.name` a `string | Buffer` and breaks every string-only op below.
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, {
        withFileTypes: true,
        encoding: 'utf8',
      }) as import('node:fs').Dirent[];
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name as string;
      if (name.startsWith('.')) continue;
      const full = join(dir, name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.isFile()) {
        const ext = extname(name).toLowerCase();
        if (SCAN_IMAGE_EXTS.has(ext)) out.push(full);
      }
    }
  };
  walk(rootPath, 0);
  return out;
}

export interface MatchCandidate {
  sourcePath: string;
  /** 1 = main / position 0. Larger numbers go later in the image array.
   *  999 = generic fallback (e.g. "anything.jpg" inside a sku-named folder). */
  indexHint: number;
  /** Tiebreaker for sort when two candidates share an indexHint. */
  sortKey: string;
}

interface SkuMatch {
  sku: string;
  indexHint: number;
  sortKey: string;
}

/** Given a file path, figure out which SKU (if any) in `skuSet` it
 *  belongs to plus its position hint. Patterns supported, in priority order:
 *
 *  1. `abc-123.jpg`              → sku "abc-123", position 1 (main)
 *  2. `abc-123-2.jpg` / `_2`     → sku "abc-123", position 2
 *  3. `abc-123/main.jpg`         → sku "abc-123", position 1
 *  4. `abc-123/2.jpg`            → sku "abc-123", position 2
 *  5. `abc-123/anything.jpg`     → sku "abc-123", position 999 (alpha fallback)
 *
 *  All matching is case-insensitive. Returns null when nothing matches.
 */
export function findCandidateSku(
  filePath: string,
  importRoot: string,
  skuSet: Set<string>,
): SkuMatch | null {
  const baseName = basename(filePath, extname(filePath));
  const lowerBase = baseName.toLowerCase().trim();
  const parentDirAbs = dirname(filePath);
  const parentName = basename(parentDirAbs).toLowerCase().trim();

  // 1. Direct full-name match
  if (skuSet.has(lowerBase)) {
    return { sku: lowerBase, indexHint: 1, sortKey: lowerBase };
  }

  // 2. Trailing numeric suffix on the filename itself
  const suffixMatch = lowerBase.match(/^(.*?)[-_\s](\d+)$/);
  if (suffixMatch) {
    const prefix = suffixMatch[1]!;
    const num = parseInt(suffixMatch[2]!, 10);
    if (skuSet.has(prefix)) {
      return { sku: prefix, indexHint: num, sortKey: lowerBase };
    }
  }

  // 3. Parent folder named after the SKU. Must not be the import root
  //    itself — files at the top level shouldn't match by parent folder.
  if (
    resolve(parentDirAbs) !== resolve(importRoot) &&
    skuSet.has(parentName)
  ) {
    if (/^\d+$/.test(lowerBase)) {
      return {
        sku: parentName,
        indexHint: parseInt(lowerBase, 10),
        sortKey: lowerBase,
      };
    }
    if (
      lowerBase === 'main' ||
      lowerBase === 'primary' ||
      lowerBase === 'cover'
    ) {
      return { sku: parentName, indexHint: 1, sortKey: lowerBase };
    }
    if (suffixMatch) {
      return {
        sku: parentName,
        indexHint: parseInt(suffixMatch[2]!, 10),
        sortKey: lowerBase,
      };
    }
    // Anything else inside an sku-named folder gets a generic later slot.
    return { sku: parentName, indexHint: 999, sortKey: lowerBase };
  }

  return null;
}

/** Group an array of absolute file paths into per-SKU candidate lists.
 *  Each group is sorted by indexHint (main first), then by sortKey for
 *  deterministic ordering. */
export function groupAndSortMatches(
  filePaths: string[],
  importRoot: string,
  skuSet: Set<string>,
): { groups: Map<string, MatchCandidate[]>; unmatched: string[] } {
  const groups = new Map<string, MatchCandidate[]>();
  const unmatched: string[] = [];

  for (const file of filePaths) {
    const m = findCandidateSku(file, importRoot, skuSet);
    if (!m) {
      unmatched.push(file);
      continue;
    }
    const list = groups.get(m.sku) ?? [];
    list.push({
      sourcePath: file,
      indexHint: m.indexHint,
      sortKey: m.sortKey,
    });
    groups.set(m.sku, list);
  }

  for (const list of groups.values()) {
    list.sort((a, b) => {
      if (a.indexHint !== b.indexHint) return a.indexHint - b.indexHint;
      return a.sortKey.localeCompare(b.sortKey);
    });
  }

  return { groups, unmatched };
}
