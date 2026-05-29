// Audit log — durable, queryable record of every mutation in the app.
//
// Mirrors Image Studio KH's audit_log model: an immutable per-event table
// you append to from every mutating operation, rather than trying to
// reconstruct "who changed what when" from current-state columns. Label
// Studio KH is single-user, so there's no user_id; instead we carry a
// company_id so the History page can scope to the active workspace.
//
// Payload sizing: on an `update`, before/after carry ONLY the keys that
// actually changed (diffPatch). A 25-field product edit where one field
// moved stores one key on each side. create/delete store a compact
// snapshot. Keeps the SQLite file from ballooning on heavy editing days.
//
// Logging never throws into the caller — an audit failure must not break
// the actual write. Every path is wrapped in try/catch and degrades to a
// no-op + stderr line.

import { getDb } from './Database';

export type AuditEntityType =
  | 'product'
  | 'image'
  | 'brand'
  | 'company'
  | 'template'
  | 'import';

export interface AuditEntry {
  id: number;
  entityType: AuditEntityType;
  entityId: string | null;
  companyId: string | null;
  action: string;
  summary: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

interface DbRow {
  id: number;
  entity_type: string;
  entity_id: string | null;
  company_id: string | null;
  action: string;
  summary: string | null;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
}

function parseJson(raw: string | null): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function rowToEntry(row: DbRow): AuditEntry {
  return {
    id: row.id,
    entityType: row.entity_type as AuditEntityType,
    entityId: row.entity_id,
    companyId: row.company_id,
    action: row.action,
    summary: row.summary,
    before: parseJson(row.before_json),
    after: parseJson(row.after_json),
    createdAt: row.created_at,
  };
}

/**
 * Diff a `before` row against a `patch`, returning ONLY the keys whose
 * value actually changed. Returns null when nothing changed (caller skips
 * logging a no-op). Compares with strict equality plus a JSON-normalize
 * fallback so nested objects (prices, customFields) don't log spuriously.
 * Skips housekeeping fields the caller may include but that aren't
 * user-meaningful.
 */
export function diffPatch(
  before: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | null | undefined,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  if (!patch || typeof patch !== 'object') return null;
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  let changed = false;
  const SKIP = new Set(['updatedAt', 'createdAt', 'id']);
  for (const key of Object.keys(patch)) {
    if (SKIP.has(key)) continue;
    const beforeVal = before?.[key];
    const afterVal = patch[key];
    const same =
      beforeVal === afterVal ||
      JSON.stringify(beforeVal ?? null) === JSON.stringify(afterVal ?? null);
    if (same) continue;
    b[key] = beforeVal ?? null;
    a[key] = afterVal;
    changed = true;
  }
  return changed ? { before: b, after: a } : null;
}

export const AuditService = {
  /** Append one event. Never throws — audit failures must not break the
   *  surrounding write. Safe to call inside a better-sqlite3 transaction. */
  log(input: {
    entityType: AuditEntityType;
    entityId?: string | null;
    companyId?: string | null;
    action: string;
    summary?: string | null;
    before?: unknown;
    after?: unknown;
  }): void {
    if (!input.entityType || !input.action) return;
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO audit_log
           (entity_type, entity_id, company_id, action, summary, before_json, after_json, created_at)
         VALUES
           (@entityType, @entityId, @companyId, @action, @summary, @beforeJson, @afterJson, @createdAt)`,
      ).run({
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        companyId: input.companyId ?? null,
        action: input.action,
        summary: input.summary ?? null,
        beforeJson: input.before == null ? null : JSON.stringify(input.before),
        afterJson: input.after == null ? null : JSON.stringify(input.after),
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[audit] log failed (${input.entityType}/${input.action}):`, err);
    }
  },

  /** Convenience for the update case — diffs before/patch and only logs
   *  when something actually changed. */
  logUpdate(input: {
    entityType: AuditEntityType;
    entityId: string;
    companyId?: string | null;
    beforeRow: Record<string, unknown>;
    patch: Record<string, unknown>;
    summary?: string | null;
  }): void {
    const d = diffPatch(input.beforeRow, input.patch);
    if (!d) return;
    AuditService.log({
      entityType: input.entityType,
      entityId: input.entityId,
      companyId: input.companyId,
      action: 'update',
      summary: input.summary ?? null,
      before: d.before,
      after: d.after,
    });
  },

  /** Global feed for the History page. Newest first. Optional filters by
   *  entity type and company. limit clamped to 1–500; offset for paging. */
  listRecent(opts?: {
    companyId?: string | null;
    entityType?: AuditEntityType | null;
    limit?: number;
    offset?: number;
  }): AuditEntry[] {
    const db = getDb();
    const limit = Math.min(Math.max(1, opts?.limit ?? 100), 500);
    const offset = Math.max(0, opts?.offset ?? 0);
    const wheres: string[] = [];
    const params: Record<string, unknown> = { limit, offset };
    if (opts?.companyId) {
      wheres.push('company_id = @companyId');
      params.companyId = opts.companyId;
    }
    if (opts?.entityType) {
      wheres.push('entity_type = @entityType');
      params.entityType = opts.entityType;
    }
    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT * FROM audit_log ${whereSql}
         ORDER BY created_at DESC, id DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all(params) as DbRow[];
    return rows.map(rowToEntry);
  },

  /** Total count for the History page pagination label. */
  countRecent(opts?: {
    companyId?: string | null;
    entityType?: AuditEntityType | null;
  }): number {
    const db = getDb();
    const wheres: string[] = [];
    const params: Record<string, unknown> = {};
    if (opts?.companyId) {
      wheres.push('company_id = @companyId');
      params.companyId = opts.companyId;
    }
    if (opts?.entityType) {
      wheres.push('entity_type = @entityType');
      params.entityType = opts.entityType;
    }
    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const row = db
      .prepare(`SELECT COUNT(*) AS n FROM audit_log ${whereSql}`)
      .get(params) as { n: number } | undefined;
    return Number(row?.n ?? 0);
  },
};
