// Company persistence. Same file-based pattern as BrandService — small set
// of records that load entirely, no need for SQLite. Companies are the
// top-level parent of Brand; the `activeCompanyId` (stored in
// settings.json) decides which Company's brands + products are visible
// across the app.
//
// On first run after the v4→v5 migration, ensureBootstrap() creates a
// default "My Company", migrates every legacy brand to belong to it, and
// backfills the new `company_id` column on the skus table. After that, the
// bootstrap is a no-op.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Company, CompanyInput } from '@shared/types/company';
import { DEFAULT_PRICE_GROUPS } from '@shared/types/company';
import type { Brand } from '@shared/types/brand';
import { paths } from './paths';
import { getDb } from './Database';

function nowIso(): string {
  return new Date().toISOString();
}

function readAll(): Company[] {
  const file = paths.companiesFile();
  if (!existsSync(file)) return [];
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as { companies?: Company[] } | Company[];
    return Array.isArray(parsed) ? parsed : (parsed.companies ?? []);
  } catch (err) {
    console.error('Failed to parse companies.json:', err);
    return [];
  }
}

function writeAll(companies: Company[]): void {
  const file = paths.companiesFile();
  paths.ensure(dirname(file));
  writeFileSync(file, JSON.stringify({ companies }, null, 2), 'utf8');
}

export const CompanyService = {
  list(): Company[] {
    return readAll();
  },

  get(id: string): Company | null {
    return readAll().find((c) => c.id === id) ?? null;
  },

  create(input: CompanyInput): Company {
    const list = readAll();
    const ts = nowIso();
    const company: Company = {
      id: randomUUID(),
      name: input.name.trim(),
      color: input.color ?? '#3B82F6', // sensible blue default
      logoPath: input.logoPath ?? null,
      address: input.address ?? '',
      phone: input.phone ?? '',
      email: input.email ?? '',
      website: input.website ?? '',
      priceGroups:
        input.priceGroups && input.priceGroups.length > 0
          ? input.priceGroups
          : [...DEFAULT_PRICE_GROUPS],
      customFields: input.customFields ?? [],
      createdAt: ts,
      updatedAt: ts,
    };
    writeAll([...list, company]);
    return company;
  },

  update(id: string, patch: Partial<CompanyInput>): Company | null {
    const list = readAll();
    const idx = list.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    const next: Company = {
      ...list[idx]!,
      ...patch,
      // Force the timestamps + id to stay correct even if patch tries to
      // overwrite them.
      id: list[idx]!.id,
      createdAt: list[idx]!.createdAt,
      updatedAt: nowIso(),
    };
    const out = [...list];
    out[idx] = next;
    writeAll(out);
    return next;
  },

  remove(id: string): boolean {
    const list = readAll();
    const next = list.filter((c) => c.id !== id);
    if (next.length === list.length) return false;
    // Refuse to delete if it's the only company — the active-company
    // contract requires at least one to exist. Better surfacing of this
    // happens in the UI; this is just a safety net.
    if (next.length === 0) {
      throw new Error('Cannot delete the only company — create another first.');
    }
    writeAll(next);
    return true;
  },

  /**
   * Idempotent bootstrap. Called once at app start, after Database.getDb()
   * runs its v4→v5 migration. Ensures:
   *   1. At least one Company exists. If none, create "My Company".
   *   2. Every Brand has a companyId. Brands missing one are assigned to
   *      the first existing company (single-tenant case) — the user can
   *      later move them.
   *   3. Every product row in `skus` has company_id populated, derived
   *      from its brand_id → brand → companyId chain.
   *
   * Safe to run on every boot. After the first successful run, all writes
   * become no-ops because every record already has the right shape.
   */
  ensureBootstrap(): void {
    // 1. At least one Company
    let companies = readAll();
    if (companies.length === 0) {
      CompanyService.create({
        name: 'My Company',
        // Keep priceGroups blank → CompanyService.create fills the default.
      });
      companies = readAll();
    }
    const defaultCompanyId = companies[0]!.id;

    // 2. Brand backfill — read brands.json directly to avoid circular dep
    //    with BrandService. Writes back only if anything actually changed.
    const brandsFile = paths.brandsFile();
    if (existsSync(brandsFile)) {
      try {
        const raw = readFileSync(brandsFile, 'utf8');
        const parsed = JSON.parse(raw) as { brands?: Brand[] } | Brand[];
        const brands = (Array.isArray(parsed) ? parsed : (parsed.brands ?? [])) as Brand[];
        let dirty = false;
        const next = brands.map((b) => {
          // Skip soft-deleted brands. A delete-then-purge cycle (which
          // runs on the next app launch) cleans them up — backfilling
          // their companyId would just be noise and could resurrect
          // them in places that filter on companyId without checking
          // deletedAt.
          if (b.deletedAt) return b;
          if (!b.companyId) {
            dirty = true;
            return { ...b, companyId: defaultCompanyId };
          }
          return b;
        });
        if (dirty) {
          paths.ensure(dirname(brandsFile));
          writeFileSync(
            brandsFile,
            JSON.stringify({ brands: next }, null, 2),
            'utf8',
          );
        }
      } catch (err) {
        console.error('Brand bootstrap failed (brands.json unreadable):', err);
      }
    }

    // 3. skus.company_id AND generations.company_id backfill via the
    //    brand→company map we just confirmed above. Only update rows
    //    where company_id IS NULL so this is cheap on repeat boots.
    try {
      const db = getDb();
      const brandsCurrent = readBrandsFromDisk();
      const brandToCompany = new Map<string, string>();
      for (const b of brandsCurrent) {
        if (b.companyId) brandToCompany.set(b.id, b.companyId);
      }

      // SKUs
      const skuRows = db
        .prepare('SELECT DISTINCT brand_id FROM skus WHERE company_id IS NULL')
        .all() as Array<{ brand_id: string }>;
      const skuUpd = db.prepare(
        'UPDATE skus SET company_id = ? WHERE brand_id = ? AND company_id IS NULL',
      );

      // Generations (v6+). Tolerate the column not existing on a
      // freshly-skipped migration (e.g. someone running against an old
      // DB shape from a downgraded binary) — try/catch the whole block.
      // Reuse the inferred type of skuUpd so .run(cid, brandId) is fully
      // typed; `ReturnType<typeof db.prepare>` widens to `Statement<unknown[]>`
      // and loses the variadic param signature.
      let genRows: Array<{ brand_id: string }> = [];
      let genUpd: typeof skuUpd | null = null;
      try {
        genRows = db
          .prepare(
            'SELECT DISTINCT brand_id FROM generations WHERE company_id IS NULL',
          )
          .all() as Array<{ brand_id: string }>;
        genUpd = db.prepare(
          'UPDATE generations SET company_id = ? WHERE brand_id = ? AND company_id IS NULL',
        );
      } catch (err) {
        if (!String(err).includes('no such column')) throw err;
      }

      const tx = db.transaction(() => {
        for (const r of skuRows) {
          const cid = brandToCompany.get(r.brand_id) ?? defaultCompanyId;
          skuUpd.run(cid, r.brand_id);
        }
        if (genUpd) {
          for (const r of genRows) {
            const cid = brandToCompany.get(r.brand_id) ?? defaultCompanyId;
            genUpd.run(cid, r.brand_id);
          }
        }
      });
      tx();
    } catch (err) {
      console.error('company_id backfill failed:', err);
    }
  },
};

/** Inline reader used by ensureBootstrap so it doesn't depend on BrandService
 *  (which would create a circular dependency — BrandService can later import
 *  CompanyService for brand-creation defaults). */
function readBrandsFromDisk(): Brand[] {
  const file = paths.brandsFile();
  if (!existsSync(file)) return [];
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as { brands?: Brand[] } | Brand[];
    return (Array.isArray(parsed) ? parsed : (parsed.brands ?? [])) as Brand[];
  } catch {
    return [];
  }
}
