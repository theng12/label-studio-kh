import {
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import type { Brand, NewBrandInput } from '@shared/types/brand';
import { paths } from './paths';
import { getDb } from './Database';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Brands written before 0.3 only have a single `logoPath`. On read, lift it
 * into a one-entry `logos` array so callers can ignore the legacy field.
 * Brands with `logos` already populated pass through unchanged.
 */
function migrateBrand(brand: Brand): Brand {
  if (brand.logos && brand.logos.length > 0) return brand;
  if (brand.logoPath) {
    return {
      ...brand,
      logos: [{ id: 'primary', name: 'Logo', path: brand.logoPath }],
    };
  }
  return { ...brand, logos: [] };
}

function readAll(): Brand[] {
  const file = paths.brandsFile();
  if (!existsSync(file)) return [];
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as { brands?: Brand[] } | Brand[];
    const list = Array.isArray(parsed) ? parsed : (parsed.brands ?? []);
    return list.map(migrateBrand);
  } catch (err) {
    console.error('Failed to parse brands.json:', err);
    return [];
  }
}

function writeAll(brands: Brand[]): void {
  const file = paths.brandsFile();
  paths.ensure(dirname(file));
  writeFileSync(file, JSON.stringify({ brands }, null, 2), 'utf8');
}

export const BrandService = {
  /** List active (non-deleted) brands. When `companyId` is provided, scopes
   *  to that company only — used by the Product Library, Templates,
   *  Generate, and File Manager pages so users only see brands from their
   *  active workspace. Pass undefined / no argument to get every brand
   *  across every company (legacy callers + tests). */
  list(companyId?: string): Brand[] {
    const all = readAll().filter((b) => !b.deletedAt);
    if (!companyId) return all;
    return all.filter((b) => b.companyId === companyId);
  },

  get(id: string): Brand | null {
    const b = readAll().find((b) => b.id === id);
    return b && !b.deletedAt ? b : null;
  },

  create(input: NewBrandInput): Brand {
    const brands = readAll();
    // companyId comes from the wizard's companyStore (the active company);
    // we also fall back to the first existing company so a brand never ends
    // up orphaned even if the renderer forgets to send one.
    let companyId: string | undefined = input.companyId;
    if (!companyId) {
      // Lazy import to avoid a circular dependency (CompanyService imports
      // the brand JSON for bootstrap → BrandService would otherwise pull
      // in CompanyService at module-load time).
      const { CompanyService } = require('./CompanyService') as typeof import('./CompanyService');
      const list = CompanyService.list();
      companyId = list[0]?.id;
    }
    const brand: Brand = {
      ...input,
      companyId,
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    brands.push(brand);
    writeAll(brands);
    return brand;
  },

  update(id: string, patch: Partial<NewBrandInput>): Brand | null {
    const brands = readAll();
    const i = brands.findIndex((b) => b.id === id);
    if (i < 0 || brands[i]!.deletedAt) return null;
    const updated: Brand = { ...brands[i]!, ...patch, id, updatedAt: nowIso() };
    brands[i] = updated;
    writeAll(brands);
    return updated;
  },

  /**
   * Soft-delete: marks the brand with `deletedAt` so it disappears from `list()`
   * but stays around for undo. The next app start purges it permanently.
   */
  delete(id: string): boolean {
    const brands = readAll();
    const i = brands.findIndex((b) => b.id === id);
    if (i < 0) return false;
    const target = brands[i]!;
    if (target.deletedAt) return true; // already soft-deleted
    brands[i] = { ...target, deletedAt: nowIso(), updatedAt: nowIso() };
    writeAll(brands);
    return true;
  },

  restore(id: string): Brand | null {
    const brands = readAll();
    const i = brands.findIndex((b) => b.id === id);
    if (i < 0) return null;
    const target = brands[i]!;
    if (!target.deletedAt) return target;
    const restored: Brand = { ...target, deletedAt: null, updatedAt: nowIso() };
    brands[i] = restored;
    writeAll(brands);
    return restored;
  },

  /**
   * Hard-delete any brand with a `deletedAt` tombstone. Called once at app
   * start so undo only works within the session that triggered the delete.
   */
  purgeDeleted(): number {
    const brands = readAll();
    const kept = brands.filter((b) => !b.deletedAt);
    if (kept.length === brands.length) return 0;
    writeAll(kept);
    return brands.length - kept.length;
  },

  /**
   * One-time cleanup that rips the seeded "Demo brand" (and everything it
   * touched) out of the workspace. Run on every boot; cheap no-op after the
   * first successful pass.
   *
   * The demo concept was helpful while the app was unfinished — users had
   * something to click around in. Now it just clutters the company / brand
   * pickers with an "Acme Demo Brand" entry the user can't delete. This
   * function removes:
   *   - any brand with `isDemo: true` from brands.json (legacy field —
   *     stripped after this pass since the type no longer carries it)
   *   - their templates dir (userData/templates/<brandId>/)
   *   - their assets dir (userData/assets/<brandId>/)
   *   - sku rows in SQLite for those brand ids
   *   - generation rows in SQLite for those brand ids
   *   - the bundled demo-products.csv at userData root
   */
  purgeDemoData(): number {
    const file = paths.brandsFile();
    if (!existsSync(file)) return 0;

    let parsed: { brands?: unknown } | unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      console.error('purgeDemoData: brands.json unreadable, skipping', err);
      return 0;
    }

    // Permissive read — `isDemo` is no longer in the Brand type, but old
    // on-disk records still have the field. Cast through `unknown` to look
    // it up without TypeScript pushback.
    const rawList = (Array.isArray(parsed)
      ? parsed
      : ((parsed as { brands?: unknown[] }).brands ?? [])) as Array<
      Record<string, unknown> & { id?: string }
    >;

    const demoBrandIds = rawList
      .filter((b) => b.isDemo === true)
      .map((b) => b.id)
      .filter((id): id is string => typeof id === 'string');
    if (demoBrandIds.length === 0) return 0;

    // 1. Remove the demo brands from brands.json (plus strip the dead
    //    `isDemo` field from any remaining brand, just to be tidy).
    const kept = rawList
      .filter((b) => b.isDemo !== true)
      .map((b) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { isDemo, ...rest } = b;
        return rest;
      });
    writeFileSync(
      file,
      JSON.stringify({ brands: kept }, null, 2),
      'utf8',
    );

    // 2. Remove templates + assets directories for the demo brands.
    for (const brandId of demoBrandIds) {
      try {
        rmSync(paths.templatesDir(brandId), { recursive: true, force: true });
      } catch (err) {
        console.error(`purgeDemoData: failed to remove templates for ${brandId}`, err);
      }
      try {
        rmSync(paths.assetsDir(brandId), { recursive: true, force: true });
      } catch (err) {
        console.error(`purgeDemoData: failed to remove assets for ${brandId}`, err);
      }
    }

    // 3. Drop SKU + generation rows tied to those brand IDs. Wrap in a
    //    transaction so a mid-flight crash doesn't leave a half-cleaned
    //    workspace.
    try {
      const db = getDb();
      const placeholders = demoBrandIds.map(() => '?').join(',');
      const tx = db.transaction(() => {
        db.prepare(
          `DELETE FROM skus WHERE brand_id IN (${placeholders})`,
        ).run(...demoBrandIds);
        db.prepare(
          `DELETE FROM generations WHERE brand_id IN (${placeholders})`,
        ).run(...demoBrandIds);
      });
      tx();
    } catch (err) {
      console.error('purgeDemoData: DB cleanup failed', err);
    }

    // 4. Remove the bundled sample CSV the demo seeder dropped next to
    //    userData. If it's already gone or never existed, ignore.
    try {
      const sampleCsv = join(app.getPath('userData'), 'demo-products.csv');
      if (existsSync(sampleCsv)) unlinkSync(sampleCsv);
    } catch (err) {
      console.error('purgeDemoData: failed to remove demo-products.csv', err);
    }

    console.log(
      `purgeDemoData: removed ${demoBrandIds.length} demo brand(s) and associated data.`,
    );
    return demoBrandIds.length;
  },
};
