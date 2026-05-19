import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Brand, NewBrandInput } from '@shared/types/brand';
import { paths } from './paths';

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
  list(): Brand[] {
    return readAll().filter((b) => !b.deletedAt);
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
    if (target.isDemo) return false; // demo brand can be hidden, never deleted
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
};
