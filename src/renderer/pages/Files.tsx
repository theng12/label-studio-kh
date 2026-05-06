import { useEffect, useMemo, useState } from 'react';
import {
  IconSearch,
  IconExternalLink,
  IconFolderOpen,
  IconRefresh,
  IconTrash,
  IconAlertCircle,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
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
  const [sizes, setSizes] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null);
  const [reprinting, setReprinting] = useState<string | null>(null);

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
    });
    setFiles(list);
    setLoading(false);
  };

  // Reload when filters change.
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, brandId, format, size]);

  const summary = useMemo(() => {
    const totalSize = files.reduce((s, f) => s + (f.file_size ?? 0), 0);
    return {
      count: files.length,
      mb: (totalSize / (1024 * 1024)).toFixed(1),
    };
  }, [files]);

  const onReprint = async (entry: FileEntry) => {
    setReprinting(entry.id);
    try {
      await window.api.files.reprint(entry.id);
      await reload();
    } finally {
      setReprinting(null);
    }
  };

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
                {files.map((f) => (
                  <tr key={f.id} className="hover:bg-bg-hover">
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
                      {new Date(f.created_at).toLocaleString()}
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
                ))}
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
            <strong>also be deleted</strong> if you confirm.
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
            await window.api.files.delete(confirmDelete.id, true);
            setConfirmDelete(null);
            await reload();
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

function filenameOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}
