import { getDb } from './Database';
import { BrandService } from './BrandService';

export interface DashboardStats {
  brandCount: number;
  skuCount: number;
  totalGenerated: number;
  timeSavedMinutes: number;
}

export interface RecentBrand {
  id: string;
  name: string;
  color: string;
  templateCount: number;
  updatedAt: string;
}

export interface ActivityEvent {
  type: 'import' | 'export';
  at: string; // ISO
  summary: string;
  detail: string;
}

export const StatsService = {
  dashboard(timeSavedPerLabelMinutes: number): DashboardStats {
    const db = getDb();
    const skuRow = db.prepare('SELECT COUNT(*) as c FROM skus').get() as { c: number };
    const genRow = db.prepare('SELECT COUNT(*) as c FROM generations').get() as { c: number };
    const brands = BrandService.list();
    return {
      brandCount: brands.length,
      skuCount: skuRow.c,
      totalGenerated: genRow.c,
      timeSavedMinutes: genRow.c * timeSavedPerLabelMinutes,
    };
  },

  recentBrands(limit = 5): RecentBrand[] {
    const brands = BrandService.list();
    const db = getDb();
    return brands
      .slice()
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, limit)
      .map((b) => {
        const tpl = db
          .prepare(
            `SELECT COUNT(DISTINCT template_id) as c FROM generations WHERE brand_id = ?`,
          )
          .get(b.id) as { c: number };
        return {
          id: b.id,
          name: b.name,
          color: b.color,
          templateCount: tpl.c,
          updatedAt: b.updatedAt,
        };
      });
  },

  recentActivity(limit = 10): ActivityEvent[] {
    const db = getDb();
    const imports = db
      .prepare(
        `SELECT id, source_filename, brand_id, row_count, created_at FROM imports ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as Array<{
      id: string;
      source_filename: string | null;
      brand_id: string | null;
      row_count: number;
      created_at: string;
    }>;

    const batches = db
      .prepare(
        `SELECT id, brand_id, total_count, created_at, completed_at FROM batches WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT ?`,
      )
      .all(limit) as Array<{
      id: string;
      brand_id: string;
      total_count: number;
      created_at: string;
      completed_at: string;
    }>;

    const events: ActivityEvent[] = [];
    for (const i of imports) {
      events.push({
        type: 'import',
        at: i.created_at,
        summary: `Imported ${i.row_count} row${i.row_count === 1 ? '' : 's'}`,
        detail: i.source_filename ?? '',
      });
    }
    for (const b of batches) {
      events.push({
        type: 'export',
        at: b.completed_at,
        summary: `Generated ${b.total_count} label${b.total_count === 1 ? '' : 's'}`,
        detail: '',
      });
    }
    return events.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
  },
};
