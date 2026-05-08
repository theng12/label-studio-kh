import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconSearch,
  IconExternalLink,
  IconFolderOpen,
  IconRefresh,
  IconTrash,
  IconAlertCircle,
  IconX,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';
import { useBrandStore } from '../stores/brandStore';

type FileEntry = Awaited<ReturnType<typeof window.api.files.list>>[number];

export default function Files() {
  const { brands, refresh } = useBrandStore();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [brandId, setBrandId] = useState<string>('');
  const [format, setFormat] = useState<'' | 'pdf' | 'png' | 'jpeg'>('');
  const [size, setSize] = useState<string>('');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [reprinting, setReprinting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{
    kind: 'reprint' | 'delete';
    done: number;
    total: number;
  } | null>(null);
  const lastClickedIdxRef = useRef<number | null>(null);

  useEffect(() => {
    void refresh();
    void window.api.files.distinctSizes().then(setSizes);
  }, [refresh]);

  const reload = async () => {
    setLoading(true);
    const list = await window.api.files.list({
      query: query.trim() || undefined,
      brandId: brandId || undefined,
      format: format || undefined,
      sizeLabel: size || undefined,
      batchId: batchFilter || undefined,
    });
    setFiles(list);
    setLoading(false);
    // Drop selections for rows that are no longer visible.
    setSelected((prev) => {
      const visibleIds = new Set(list.map((f) => f.id));
      const next = new Set<string>();
      for (const id of prev) if (visibleIds.has(id)) next.add(id);
      return next;
    });
  };

  // Reload when filters change.
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, brandId, format, size, batchFilter]);

  const summary = useMemo(() => {
    const totalSize = files.reduce((s, f) => s + (f.file_size ?? 0), 0);
    return {
      count: files.length,
      mb: (totalSize / (1024 * 1024)).toFixed(1),
    };
  }, [files]);

  const allVisibleSelected =
    files.length > 0 && files.every((f) => selected.has(f.id));
  const someVisibleSelected =
    !allVisibleSelected && files.some((f) => selected.has(f.id));

  const toggleAllVisible = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const f of files) next.delete(f.id);
        return next;
      }
      const next = new Set(prev);
      for (const f of files) next.add(f.id);
      return next;
    });
  };

  const toggleRow = (idx: number, shiftKey: boolean) => {
    const file = files[idx];
    if (!file) return;
    const lastIdx = lastClickedIdxRef.current;
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastIdx !== null && lastIdx !== idx) {
        const [start, end] = lastIdx < idx ? [lastIdx, idx] : [idx, lastIdx];
        const targetState = !prev.has(file.id);
        for (let i = start; i <= end; i++) {
          const f = files[i];
          if (!f) continue;
          if (targetState) next.add(f.id);
          else next.delete(f.id);
        }
      } else {
        if (next.has(file.id)) next.delete(file.id);
        else next.add(file.id);
      }
      return next;
    });
    lastClickedIdxRef.current = idx;
  };

  const onReprint = async (entry: FileEntry) => {
    setReprinting(entry.id);
    try {
      await window.api.files.reprint(entry.id);
      await reload();
    } finally {
      setReprinting(null);
    }
  };

  const selectedFiles = useMemo(
    () => files.filter((f) => selected.has(f.id)),
    [files, selected],
  );

  const onBulkReprint = async () => {
    if (selectedFiles.length === 0) return;
    setBulkProgress({ kind: 'reprint', done: 0, total: selectedFiles.length });
    const errors: string[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i];
      try {
        await window.api.files.reprint(f.id);
      } catch (err) {
        console.error('Reprint failed for', f.id, err);
        errors.push(`${f.sku}: ${(err as Error).message ?? 'unknown error'}`);
      }
      setBulkProgress({ kind: 'reprint', done: i + 1, total: selectedFiles.length });
    }
    setBulkProgress(null);
    if (errors.length > 0) {
      alert(`Reprint completed with ${errors.length} error(s):\n${errors.join('\n')}`);
    }
    await reload();
  };

  const restoreFiles = async (ids: string[]) => {
    let restored = 0;
    for (const id of ids) {
      try {
        const ok = await window.api.files.restore(id);
        if (ok) restored++;
      } catch (err) {
        console.error('Restore failed for', id, err);
      }
    }
    await reload();
    if (restored > 0) {
      toast.success(`Restored ${restored} file${restored === 1 ? '' : 's'}.`);
    }
  };

  const onBulkDeleteConfirmed = async () => {
    setConfirmBulkDelete(false);
    if (selectedFiles.length === 0) return;
    setBulkProgress({ kind: 'delete', done: 0, total: selectedFiles.length });
    const failed = new Set<string>();
    const succeeded: string[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i];
      try {
        const ok = await window.api.files.delete(f.id, true);
        if (ok) succeeded.push(f.id);
        else failed.add(f.id);
      } catch (err) {
        console.error('Delete failed for', f.id, err);
        failed.add(f.id);
      }
      setBulkProgress({ kind: 'delete', done: i + 1, total: selectedFiles.length });
    }
    setBulkProgress(null);
    // Keep failed selections, drop the successes.
    setSelected(failed);
    if (failed.size > 0) {
      alert(`Failed to delete ${failed.size} file(s). They remain selected.`);
    }
    await reload();
    if (succeeded.length > 0) {
      toast.info(
        `Deleted ${succeeded.length} file${succeeded.length === 1 ? '' : 's'}.`,
        {
          action: {
            label: 'Undo',
            onClick: () => {
              void restoreFiles(succeeded);
            },
          },
        },
      );
    }
  };

  const filterBrandName =
    brandId && brands.find((b) => b.id === brandId)?.name;

  return (
    <>
      <Page title="File Manager">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <IconSearch
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU or filename…"
              className="h-9 w-full rounded-md border border-border-base bg-bg-surface pl-8 pr-3 text-sm text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">All formats</option>
            <option value="pdf">PDF</option>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>

          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">All sizes</option>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <Button size="sm" variant="ghost" onClick={() => void reload()}>
            <IconRefresh size={14} /> Refresh
          </Button>

          <span className="ml-auto text-xs text-fg-muted">
            {summary.count} file{summary.count === 1 ? '' : 's'} · {summary.mb} MB
          </span>
        </div>

        {batchFilter && (
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span className="text-fg-muted">Filtered to batch:</span>
            <button
              onClick={() => setBatchFilter('')}
              className="inline-flex items-center gap-1 rounded-full border border-border-base bg-bg-elevated px-2 py-0.5 font-mono text-fg-base hover:bg-bg-hover"
              title="Clear batch filter"
            >
              <span className="truncate max-w-[180px]">{batchFilter.slice(0, 8)}</span>
              <IconX size={10} />
            </button>
            {filterBrandName && (
              <span className="text-fg-subtle">· {filterBrandName}</span>
            )}
          </div>
        )}

        {selected.size > 0 && (
          <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border-base bg-bg-elevated px-3 py-2">
            <span className="text-xs font-medium text-fg-base">
              {selected.size} selected
            </span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-fg-muted hover:text-fg-base"
            >
              Clear
            </button>
            {bulkProgress && (
              <span className="text-xs text-fg-muted">
                {bulkProgress.kind === 'reprint' ? 'Reprinting' : 'Deleting'}{' '}
                {bulkProgress.done}/{bulkProgress.total}…
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!!bulkProgress}
                onClick={() => void onBulkReprint()}
              >
                <IconRefresh size={12} /> Reprint {selected.size} file
                {selected.size === 1 ? '' : 's'}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!!bulkProgress}
                onClick={() => setConfirmBulkDelete(true)}
              >
                <IconTrash size={12} /> Delete {selected.size} file
                {selected.size === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
            Loading…
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-base p-12 text-center text-sm text-fg-muted">
            No files yet. Generate some from the Generate page.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-base">
            <table className="w-full text-xs">
              <thead className="bg-bg-elevated text-fg-muted">
                <tr>
                  <th className="w-8 px-2 py-2 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all visible"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected;
                      }}
                      onChange={toggleAllVisible}
                      className="cursor-pointer accent-accent"
                    />
                  </th>
                  <th className="px-2 py-2 text-left">SKU</th>
                  <th className="px-2 py-2 text-left">Brand</th>
                  <th className="px-2 py-2 text-left">Size</th>
                  <th className="px-2 py-2 text-left">Format</th>
                  <th className="px-2 py-2 text-left">DPI</th>
                  <th className="px-2 py-2 text-left">Generated</th>
                  <th className="px-2 py-2 text-left">Filename</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, idx) => {
                  const isSelected = selected.has(f.id);
                  return (
                    <tr
                      key={f.id}
                      className={
                        isSelected
                          ? 'bg-accent/10 hover:bg-accent/15'
                          : 'hover:bg-bg-hover'
                      }
                    >
                      <td className="border-b border-border-subtle px-2 py-1.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${f.sku}`}
                          checked={isSelected}
                          onChange={(e) =>
                            toggleRow(
                              idx,
                              (e.nativeEvent as MouseEvent).shiftKey ?? false,
                            )
                          }
                          className="cursor-pointer accent-accent"
                        />
                      </td>
                      <td className="border-b border-border-subtle px-2 py-1.5 font-mono">
                        {f.sku}
                      </td>
                      <td className="border-b border-border-subtle px-2 py-1.5">
                        {f.brand_name ?? '—'}
                      </td>
                      <td className="border-b border-border-subtle px-2 py-1.5">
                        {f.size_label}
                      </td>
                      <td className="border-b border-border-subtle px-2 py-1.5 uppercase">
                        {f.format}
                      </td>
                      <td className="border-b border-border-subtle px-2 py-1.5">
                        {f.dpi}
                      </td>
                      <td className="border-b border-border-subtle px-2 py-1.5 text-fg-muted">
                        {f.batch_id ? (
                          <button
                            onClick={() => setBatchFilter(f.batch_id ?? '')}
                            title="Filter to this batch"
                            className="rounded px-1 py-0.5 hover:bg-bg-elevated hover:text-fg-base"
                          >
                            {new Date(f.created_at).toLocaleString()}
                          </button>
                        ) : (
                          <span>{new Date(f.created_at).toLocaleString()}</span>
                        )}
                      </td>
                      <td className="border-b border-border-subtle px-2 py-1.5 max-w-[260px] truncate text-fg-muted">
                        <span className="flex items-center gap-1">
                          {!f.exists && (
                            <span title="File missing on disk">
                              <IconAlertCircle size={12} className="text-warning" />
                            </span>
                          )}
                          <span>{filenameOf(f.file_path)}</span>
                        </span>
                      </td>
                      <td className="border-b border-border-subtle px-2 py-1.5 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            title="Open file"
                            disabled={!f.exists}
                            onClick={() => window.api.export.openInOS(f.file_path)}
                            className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base disabled:opacity-40"
                          >
                            <IconExternalLink size={12} />
                          </button>
                          <button
                            title="Reveal in Finder"
                            onClick={() => window.api.export.revealInFinder(f.file_path)}
                            className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
                          >
                            <IconFolderOpen size={12} />
                          </button>
                          <button
                            title="Reprint (uses original snapshot)"
                            disabled={reprinting === f.id}
                            onClick={() => void onReprint(f)}
                            className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base disabled:opacity-40"
                          >
                            <IconRefresh size={12} />
                          </button>
                          <button
                            title="Delete record"
                            onClick={() => setConfirmDelete(f)}
                            className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-danger"
                          >
                            <IconTrash size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {files.length === 500 && (
              <div className="bg-bg-elevated px-2 py-1 text-[10px] text-fg-subtle">
                Showing latest 500 results. Use filters to narrow further.
              </div>
            )}
          </div>
        )}
      </Page>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete file record?"
        message={
          <>
            Removes this entry from the file index. The file on disk will{' '}
            <strong>also be deleted</strong> if you confirm. You can undo this
            from the toast that appears.
            <br />
            <br />
            <code className="break-all rounded bg-bg-elevated px-1 py-0.5 text-[10px]">
              {confirmDelete?.file_path}
            </code>
          </>
        }
        confirmLabel="Delete file + record"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={async () => {
          if (confirmDelete) {
            const target = confirmDelete;
            const ok = await window.api.files.delete(target.id, true);
            setConfirmDelete(null);
            await reload();
            if (ok) {
              toast.info(`Deleted ${filenameOf(target.file_path)}.`, {
                action: {
                  label: 'Undo',
                  onClick: () => {
                    void restoreFiles([target.id]);
                  },
                },
              });
            }
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selected.size} file${selected.size === 1 ? '' : 's'}?`}
        message={
          <>
            Removes <strong>{selected.size}</strong> entries from the file index.
            The files on disk will <strong>also be deleted</strong>. You can undo
            this from the toast that appears.
          </>
        }
        confirmLabel={`Delete ${selected.size} file${selected.size === 1 ? '' : 's'}`}
        cancelLabel="Keep them"
        tone="danger"
        onConfirm={() => void onBulkDeleteConfirmed()}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </>
  );
}

function filenameOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}
