import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { paths } from './paths';

const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp']);

/**
 * Copies an arbitrary user-picked file into a brand's assets folder under
 * userData and returns the new permanent path.
 *
 * `kind` is just a filename prefix (e.g. "logo", "cert") so files in the assets
 * folder are easy to identify by hand. The actual filename always has a UUID
 * suffix to avoid collisions when the same brand has multiple logos/certs over
 * its lifetime.
 */
export const AssetService = {
  importFile(brandId: string, sourcePath: string, kind: 'logo' | 'cert'): string {
    if (!brandId) throw new Error('brandId is required');
    if (!existsSync(sourcePath)) throw new Error(`Source file not found: ${sourcePath}`);

    const ext = extname(sourcePath).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      throw new Error(
        `Unsupported file type "${ext}". Use PNG, JPG, JPEG, SVG, or WEBP.`,
      );
    }

    const dir = paths.assetsDir(brandId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const filename = `${kind}-${randomUUID().slice(0, 8)}${ext}`;
    const dest = join(dir, filename);
    copyFileSync(sourcePath, dest);
    return dest;
  },

  /** Best-effort delete of an asset file. Silently ignores missing files. */
  removeFile(filePath: string): void {
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to remove asset ${filePath}:`, err);
    }
  },
};
