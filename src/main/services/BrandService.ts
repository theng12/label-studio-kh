import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Brand, NewBrandInput } from '@shared/types/brand';
import { paths } from './paths';

function nowIso(): string {
  return new Date().toISOString();
}

function readBrands(): Brand[] {
  const file = paths.brandsFile();
  if (!existsSync(file)) return [];
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as { brands?: Brand[] } | Brand[];
    if (Array.isArray(parsed)) return parsed;
    return parsed.brands ?? [];
  } catch (err) {
    console.error('Failed to parse brands.json:', err);
    return [];
  }
}

function writeBrands(brands: Brand[]): void {
  const file = paths.brandsFile();
  paths.ensure(dirname(file));
  writeFileSync(file, JSON.stringify({ brands }, null, 2), 'utf8');
}

export const BrandService = {
  list(): Brand[] {
    return readBrands();
  },

  get(id: string): Brand | null {
    return readBrands().find((b) => b.id === id) ?? null;
  },

  create(input: NewBrandInput): Brand {
    const brands = readBrands();
    const brand: Brand = {
      ...input,
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    brands.push(brand);
    writeBrands(brands);
    return brand;
  },

  update(id: string, patch: Partial<NewBrandInput>): Brand | null {
    const brands = readBrands();
    const i = brands.findIndex((b) => b.id === id);
    if (i < 0) return null;
    const updated: Brand = { ...brands[i]!, ...patch, id, updatedAt: nowIso() };
    brands[i] = updated;
    writeBrands(brands);
    return updated;
  },

  delete(id: string): boolean {
    const brands = readBrands();
    const target = brands.find((b) => b.id === id);
    if (!target) return false;
    if (target.isDemo) return false; // demo brand can be hidden, never deleted
    const next = brands.filter((b) => b.id !== id);
    writeBrands(next);
    return true;
  },
};
