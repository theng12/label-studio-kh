import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconTrash, IconAlertTriangle } from '@tabler/icons-react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { toast } from '../../components/Toast';
import { useBrandStore } from '../../stores/brandStore';

type ImportEntry = Awaited<ReturnType<typeof window.api.import.listImports>>[number];

export function ImportHistory() {
  const { t } = useTranslation();
  const { brands } = useBrandStore();
  const [imports, setImports] = useState<ImportEntry[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<ImportEntry | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const refresh = () => {
    void window.api.import.listImports().then(setImports);
  };

  useEffect(refresh, []);

  const brandName = (id: string | null) =>
    id ? brands.find((b) => b.id === id)?.name ?? id : '—';

  const onDelete = async (entry: ImportEntry) => {
    setConfirmDelete(null);
    const ok = await window.api.import.deleteImport(entry.id);
    if (ok) {
      toast.info(`Removed history entry for "${entry.source_filename ?? entry.id}".`);
      refresh();
    }
  };

  const onClearAll = async () => {
    setConfirmClearAll(false);
    const n = await window.api.import.clearImports();
    if (n > 0) {
      toast.info(`Cleared ${n} history entr${n === 1 ? 'y' : 'ies'}.`);
    }
    refresh();
  };

  return (
    <div className="space-y-3">
      {/* Safety note: an audit-log explanation so the user knows deleting
          history won't affect their actual SKUs. This is the question they
          actually asked — answering it inline beats hiding it in docs. */}
      <div className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-[11px] text-fg-muted">
        <span className="font-medium text-fg-base">About this list:</span> these are
        audit-log entries — one row per CSV/Excel import. Deleting an entry here
        does <strong>not</strong> remove any SKUs, brands, or generated files; SKUs
        live in their own table keyed by SKU code and survive history changes.
        Re-importing an updated CSV always overwrites the SKU rows by SKU code,
        independent of what's in this history. Safe to prune at any time.
      </div>

      {imports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
          {t('dataImport.history.empty')}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-muted">
              {imports.length} entr{imports.length === 1 ? 'y' : 'ies'}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmClearAll(true)}
              title="Permanently remove every history entry across all brands"
            >
              <IconTrash size={12} /> Clear all history
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border-base">
            <table className="w-full text-xs">
              <thead className="bg-bg-elevated text-fg-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left">{t('dataImport.history.table.date')}</th>
                  <th className="px-2 py-1.5 text-left">{t('dataImport.history.table.file')}</th>
                  <th className="px-2 py-1.5 text-left">Brand</th>
                  <th className="px-2 py-1.5 text-right">{t('dataImport.history.table.rows')}</th>
                  <th className="w-10 px-2 py-1.5 text-right" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {imports.map((i) => (
                  <tr key={i.id} className="hover:bg-bg-hover">
                    <td className="border-b border-border-subtle px-2 py-1.5">
                      {new Date(i.created_at).toLocaleString()}
                    </td>
                    <td className="border-b border-border-subtle px-2 py-1.5">
                      {i.source_filename ?? '—'}
                    </td>
                    <td className="border-b border-border-subtle px-2 py-1.5">
                      {brandName(i.brand_id)}
                    </td>
                    <td className="border-b border-border-subtle px-2 py-1.5 text-right font-mono">
                      {i.row_count.toLocaleString()}
                    </td>
                    <td className="border-b border-border-subtle px-2 py-1.5 text-right">
                      <button
                        onClick={() => setConfirmDelete(i)}
                        title="Remove this history entry (SKUs unaffected)"
                        className="rounded p-1 text-fg-muted hover:bg-bg-elevated hover:text-danger"
                      >
                        <IconTrash size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Remove this history entry?"
        message={
          <>
            Removes the audit-log row for{' '}
            <strong>{confirmDelete?.source_filename ?? '(unnamed file)'}</strong>{' '}
            ({confirmDelete?.row_count.toLocaleString()} rows,{' '}
            {confirmDelete && new Date(confirmDelete.created_at).toLocaleString()}).
            <br />
            <br />
            <span className="text-fg-muted">
              SKUs imported by this run are <strong>not</strong> deleted —
              they're keyed by SKU code in a separate table. Only the log
              entry goes away.
            </span>
          </>
        }
        confirmLabel="Remove entry"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={() => confirmDelete && void onDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={confirmClearAll}
        title={`Clear all ${imports.length} history entries?`}
        message={
          <>
            <span className="inline-flex items-center gap-1 text-warning">
              <IconAlertTriangle size={14} />
              This wipes every import-log row, across all brands.
            </span>
            <br />
            <br />
            SKUs, brands, templates, and generated files are{' '}
            <strong>untouched</strong>. Only the audit log is cleared. Useful
            when the list has gotten noisy and you don't need it for tracing
            who imported what when.
          </>
        }
        confirmLabel={`Clear ${imports.length} entries`}
        cancelLabel="Keep them"
        tone="danger"
        onConfirm={() => void onClearAll()}
        onCancel={() => setConfirmClearAll(false)}
      />
    </div>
  );
}
