// /history — global audit-log feed. Shows every recorded mutation in the
// active workspace: product create/update/delete, image add/remove/
// set-main/reorder, and CSV imports. Filterable by event type, paginated.
//
// The data comes from the audit_log table (written by the services). This
// page is read-only — it's a record, not an editor.

import { useEffect, useMemo, useState } from 'react';
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconPhoto,
  IconPhotoOff,
  IconStar,
  IconArrowsSort,
  IconFileImport,
  IconHistory,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { useCompanyStore } from '../stores/companyStore';

type Entry = Awaited<ReturnType<typeof window.api.audit.listRecent>>[number];
type EntityFilter =
  | 'all'
  | 'product'
  | 'image'
  | 'import';

const PAGE_SIZE = 50;

const FILTERS: ReadonlyArray<{ value: EntityFilter; label: string }> = [
  { value: 'all', label: 'All activity' },
  { value: 'product', label: 'Products' },
  { value: 'image', label: 'Images' },
  { value: 'import', label: 'Imports' },
];

export default function History() {
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const [filter, setFilter] = useState<EntityFilter>('all');
  const [page, setPage] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const entityType = filter === 'all' ? null : filter;

  useEffect(() => {
    setPage(0);
  }, [filter, activeCompanyId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const companyId = activeCompanyId ?? undefined;
    void Promise.all([
      window.api.audit.listRecent({
        companyId,
        entityType,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
      window.api.audit.countRecent({ companyId, entityType }),
    ])
      .then(([rows, count]) => {
        if (cancelled) return;
        setEntries(rows);
        setTotal(count);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, page, activeCompanyId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <Page title="History" subtitle="Every recorded change in this workspace">
      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={[
              'rounded-full border px-3 py-1 text-xs transition-colors',
              filter === f.value
                ? 'border-accent bg-accent/10 text-fg-base'
                : 'border-border-base text-fg-muted hover:bg-bg-hover hover:text-fg-base',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-fg-muted">
          {total === 0
            ? 'No activity yet'
            : `Showing ${start}–${end} of ${total.toLocaleString()}`}
        </span>
      </div>

      {loading && entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
          Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
          <IconHistory size={28} className="mx-auto mb-3 text-fg-subtle" />
          <h3 className="text-sm font-semibold text-fg-base">Nothing here yet</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
            As you create, edit, delete products, manage images, and import
            data, every change is recorded here.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border-base">
            <ul className="divide-y divide-border-subtle">
              {entries.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </ul>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs text-fg-muted">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded border border-border-base px-2 py-1 hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                ‹ Prev
              </button>
              <span>
                Page {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded border border-border-base px-2 py-1 hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

// Visual treatment per action — icon + accent color so the feed scans fast.
function actionVisual(action: string): {
  Icon: typeof IconPencil;
  cls: string;
} {
  switch (action) {
    case 'create':
      return { Icon: IconPlus, cls: 'text-success' };
    case 'delete':
      return { Icon: IconTrash, cls: 'text-danger' };
    case 'update':
      return { Icon: IconPencil, cls: 'text-accent' };
    case 'image:add':
      return { Icon: IconPhoto, cls: 'text-success' };
    case 'image:remove':
      return { Icon: IconPhotoOff, cls: 'text-danger' };
    case 'image:set-main':
      return { Icon: IconStar, cls: 'text-warning' };
    case 'image:reorder':
      return { Icon: IconArrowsSort, cls: 'text-fg-muted' };
    case 'import':
      return { Icon: IconFileImport, cls: 'text-accent' };
    default:
      return { Icon: IconPencil, cls: 'text-fg-muted' };
  }
}

function EntryRow({ entry }: { entry: Entry }) {
  const { Icon, cls } = actionVisual(entry.action);
  // For update events, render the changed-keys diff compactly.
  const diff = useMemo(() => {
    if (entry.action !== 'update') return null;
    const before = (entry.before ?? {}) as Record<string, unknown>;
    const after = (entry.after ?? {}) as Record<string, unknown>;
    const keys = Object.keys(after);
    if (keys.length === 0) return null;
    return keys.map((k) => ({
      key: k,
      from: fmtVal(before[k]),
      to: fmtVal(after[k]),
    }));
  }, [entry]);

  return (
    <li className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-bg-hover">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bg-elevated ${cls}`}
      >
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-fg-base">
          {entry.summary ?? `${entry.action} ${entry.entityType}`}
        </div>
        {diff && diff.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {diff.slice(0, 6).map((d) => (
              <div key={d.key} className="text-[11px] text-fg-muted">
                <span className="font-medium text-fg-subtle">{d.key}:</span>{' '}
                <span className="line-through opacity-70">{d.from}</span>{' '}
                <span aria-hidden>→</span>{' '}
                <span className="text-fg-base">{d.to}</span>
              </div>
            ))}
            {diff.length > 6 && (
              <div className="text-[11px] text-fg-subtle">
                +{diff.length - 6} more field{diff.length - 6 === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}
      </div>
      <span className="shrink-0 text-xs text-fg-subtle" title={entry.createdAt}>
        {formatRelative(entry.createdAt)}
      </span>
    </li>
  );
}

function fmtVal(v: unknown): string {
  if (v == null || v === '') return '∅';
  if (typeof v === 'object') {
    try {
      const s = JSON.stringify(v);
      return s.length > 40 ? s.slice(0, 40) + '…' : s;
    } catch {
      return '[object]';
    }
  }
  const s = String(v);
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
