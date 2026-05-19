import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconSearch,
  IconExternalLink,
  IconFolderOpen,
  IconRefresh,
  IconTrash,
  IconAlertCircle,
  IconX,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconTable,
  IconLayoutGrid,
  IconBuildingStore,
  IconFileTypePdf,
  IconPhoto,
  IconPackage,
  IconDatabase,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';
import { useBrandStore } from '../stores/brandStore';
import { useCompanyStore } from '../stores/companyStore';
import { useAssetsDir } from '../hooks/useAssetsDir';

// File Manager — generation-asset browser. Files come out of the Generate
// page (and any other code that writes a row to the `generations` table).
//
// Layout matches Product Library for consistency: a left sidebar with
// Brand / Format / Size filters, plus a top bar with search + view toggle.
// Storage stats live at the top of the page so heavy users can see disk
// usage at a glance.

type FileEntry = Awaited<
  ReturnType<typeof window.api.files.listPaged>
>['rows'][number];

type SortKey =
  | 'created_at'
  | 'sku'
  | 'brand'
  | 'size_label'
  | 'format'
  | 'dpi'
  | 'file_path';

type ViewMode = 'table' | 'grid';

export default function Files() {
  const navigate = useNavigate();
  const { brands, refresh: refreshBrands } = useBrandStore();
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const assetsDir = useAssetsDir();

  // ── Data state ────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sizes, setSizes] = useState<string[]>([]);
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof window.api.files.storageStats>
  > | null>(null);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [brandId, setBrandId] = useState<string>(''); // '' = all brands
  const [format, setFormat] = useState<'' | 'pdf' | 'png' | 'jpeg'>('');
  const [size, setSize] = useState<string>('');
  const [batchFilter, setBatchFilter] = useState<string>('');

  // ── View / pagination / sort ──────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>('table');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  // ── Selection + bulk ops ──────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [reprinting, setReprinting] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{
    kind: 'reprint' | 'delete';
    done: number;
    total: number;
  } | null>(null);
  const lastClickedIdxRef = useRef<number | null>(null);

  // Brand list scoped to the active company. The sidebar only lists brands
  // that belong to the workspace the user is currently in.
  const brandsForCompany = useMemo(
    () =>
      brands.filter(
        (b) => !activeCompanyId || b.companyId === activeCompanyId,
      ),
    [brands, activeCompanyId],
  );

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    void refreshBrands();
  }, [refreshBrands]);

  // Distinct sizes + storage stats refresh whenever the active company
  // changes, OR after file mutations (handled via reload() chain).
  useEffect(() => {
    if (!activeCompanyId) return;
    void window.api.files.distinctSizes(activeCompanyId).then(setSizes);
    void window.api.files.storageStats(activeCompanyId).then(setStats);
  }, [activeCompanyId]);

  // Reset page when any filter or page-size changes.
  useEffect(() => {
    setPage(0);
  }, [
    query,
    brandId,
    format,
    size,
    batchFilter,
    sortKey,
    sortDir,
    pageSize,
    activeCompanyId,
  ]);

  // Reload whenever any input changes.
  useEffect(() => {
    if (!activeCompanyId) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query,
    brandId,
    format,
    size,
    batchFilter,
    sortKey,
    sortDir,
    page,
    pageSize,
    activeCompanyId,
  ]);

  const reload = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const result = await window.api.files.listPaged({
      filters: {
        query: query.trim() || undefined,
        companyId: activeCompanyId,
        brandId: brandId || undefined,
        format: format || undefined,
        sizeLabel: size || undefined,
        batchId: batchFilter || undefined,
      },
      sortKey,
      sortDir,
      page: safePage,
      pageSize,
    });
    setFiles(result.rows);
    setTotal(result.total);
    setLoading(false);
    // Drop selections for rows that are no longer visible.
    setSelected((prev) => {
      const visibleIds = new Set(result.rows.map((f) => f.id));
      const next = new Set<string>();
      for (const id of prev) if (visibleIds.has(id)) next.add(id);
      return next;
    });
    // Refresh stats too — bulk delete shrinks the totals.
    void window.api.files.storageStats(activeCompanyId).then(setStats);
  };

  const onSortToggle = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Sensible default per column: dates newest first, everything else asc.
      setSortDir(key === 'created_at' ? 'desc' : 'asc');
    }
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

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

  // ── Row actions ───────────────────────────────────────────────────────────

  const onReprint = async (entry: FileEntry) => {
    setReprinting(entry.id);
    try {
      await window.api.files.reprint(entry.id);
      await reload();
    } finally {
      setReprinting(null);
    }
  };

  /** Resolve a file's source product and jump to /products with the edit
   *  modal open for it. The router param ?edit=<id> is consumed by
   *  Products.tsx on mount. */
  const onOpenProduct = async (entry: FileEntry) => {
    try {
      const product = await window.api.products.getBySku(
        entry.brand_id,
        entry.sku,
      );
      if (!product) {
        toast.error(`No product found for ${entry.sku}.`);
        return;
      }
      navigate(`/products?edit=${product.id}`);
    } catch (err) {
      toast.error(`Couldn't open product: ${String(err)}`);
    }
  };

  // ── Bulk ops ──────────────────────────────────────────────────────────────

  const selectedFiles = useMemo(
    () => files.filter((f) => selected.has(f.id)),
    [files, selected],
  );

  const onBulkReprint = async () => {
    if (selectedFiles.length === 0) return;
    setBulkProgress({ kind: 'reprint', done: 0, total: selectedFiles.length });
    const errors: string[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i]!;
      try {
        await window.api.files.reprint(f.id);
      } catch (err) {
        console.error('Reprint failed for', f.id, err);
        errors.push(`${f.sku}: ${(err as Error).message ?? 'unknown error'}`);
      }
      setBulkProgress({
        kind: 'reprint',
        done: i + 1,
        total: selectedFiles.length,
      });
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
      const f = selectedFiles[i]!;
      try {
        const ok = await window.api.files.delete(f.id, true);
        if (ok) succeeded.push(f.id);
        else failed.add(f.id);
      } catch (err) {
        console.error('Delete failed for', f.id, err);
        failed.add(f.id);
      }
      setBulkProgress({
        kind: 'delete',
        done: i + 1,
        total: selectedFiles.length,
      });
    }
    setBulkProgress(null);
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
    brandId && brandsForCompany.find((b) => b.id === brandId)?.name;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Page
        title="File Manager"
        actions={
          <div className="flex rounded-md border border-border-base bg-bg-surface p-0.5">
            <ViewToggleBtn
              active={view === 'table'}
              onClick={() => setView('table')}
              title="Table view"
            >
              <IconTable size={13} /> Table
            </ViewToggleBtn>
            <ViewToggleBtn
              active={view === 'grid'}
              onClick={() => setView('grid')}
              title="Grid view with thumbnails"
            >
              <IconLayoutGrid size={13} /> Grid
            </ViewToggleBtn>
          </div>
        }
      >
        {/* Storage stats card — total + per-format breakdown for the
            active company. Helpful to spot when disk usage starts ballooning
            after a few thousand generated labels. */}
        <StorageCard stats={stats} />

        {/* Batch chip filter — surfaces above the layout because it's a
            cross-cutting filter that escapes the sidebar's per-category UX. */}
        {batchFilter && (
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span className="text-fg-muted">Filtered to batch:</span>
            <button
              onClick={() => setBatchFilter('')}
              className="inline-flex items-center gap-1 rounded-full border border-border-base bg-bg-elevated px-2 py-0.5 font-mono text-fg-base hover:bg-bg-hover"
              title="Clear batch filter"
            >
              <span className="truncate max-w-[180px]">
                {batchFilter.slice(0, 8)}
              </span>
              <IconX size={10} />
            </button>
            {filterBrandName && (
              <span className="text-fg-subtle">· {filterBrandName}</span>
            )}
          </div>
        )}

        {/* Sticky bulk-action bar */}
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

        <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-4">
          {/* Sidebar filters — matches Product Library layout */}
          <aside className="space-y-4">
            <FilterGroup label="Brand" icon={<IconBuildingStore size={11} />}>
              <SidebarItem
                active={brandId === ''}
                onClick={() => setBrandId('')}
              >
                All brands
              </SidebarItem>
              {brandsForCompany.map((b) => (
                <SidebarItem
                  key={b.id}
                  active={brandId === b.id}
                  onClick={() => setBrandId(b.id)}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded border border-border-base"
                    style={{ background: b.color }}
                  />
                  <span className="truncate">{b.name}</span>
                </SidebarItem>
              ))}
            </FilterGroup>

            <FilterGroup label="Format">
              <SidebarItem
                active={format === ''}
                onClick={() => setFormat('')}
              >
                All formats
              </SidebarItem>
              {(['pdf', 'png', 'jpeg'] as const).map((f) => (
                <SidebarItem
                  key={f}
                  active={format === f}
                  onClick={() => setFormat(f)}
                >
                  <span className="truncate uppercase">{f}</span>
                  {stats?.byFormat[f] && (
                    <span className="ml-auto text-[10px] text-fg-subtle">
                      {stats.byFormat[f]!.count.toLocaleString()}
                    </span>
                  )}
                </SidebarItem>
              ))}
            </FilterGroup>

            <FilterGroup label="Size">
              <SidebarItem active={size === ''} onClick={() => setSize('')}>
                All sizes
              </SidebarItem>
              {sizes.map((s) => (
                <SidebarItem
                  key={s}
                  active={size === s}
                  onClick={() => setSize(s)}
                >
                  <span className="truncate">{s}</span>
                </SidebarItem>
              ))}
              {sizes.length === 0 && (
                <div className="px-2 py-1.5 text-[10px] text-fg-subtle">
                  No sizes yet.
                </div>
              )}
            </FilterGroup>
          </aside>

          {/* Main: search + table/grid + pagination */}
          <main className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
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
              <Button size="sm" variant="ghost" onClick={() => void reload()}>
                <IconRefresh size={14} /> Refresh
              </Button>
              <span className="ml-auto text-xs text-fg-muted">
                {total === 0
                  ? 'No files match'
                  : `${total.toLocaleString()} file${total === 1 ? '' : 's'} match`}
              </span>
            </div>

            {loading && files.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
                Loading…
              </div>
            ) : files.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-base p-12 text-center text-sm text-fg-muted">
                No files yet. Generate some from the Generate page.
              </div>
            ) : view === 'grid' ? (
              <div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {files.map((f, idx) => (
                    <GridCard
                      key={f.id}
                      file={f}
                      assetsDir={assetsDir}
                      brandColor={
                        brandsForCompany.find((b) => b.id === f.brand_id)
                          ?.color
                      }
                      selected={selected.has(f.id)}
                      onToggleSelect={(shift) => toggleRow(idx, shift)}
                      onOpen={() =>
                        void window.api.export.openInOS(f.file_path)
                      }
                      onReveal={() =>
                        void window.api.export.revealInFinder(f.file_path)
                      }
                      onReprint={() => void onReprint(f)}
                      onDelete={() => setConfirmDelete(f)}
                      onOpenProduct={() => void onOpenProduct(f)}
                      onFilterBatch={() => f.batch_id && setBatchFilter(f.batch_id)}
                      reprinting={reprinting === f.id}
                    />
                  ))}
                </div>
                <PaginationFooter
                  start={safePage * pageSize}
                  pageSize={pageSize}
                  total={total}
                  safePage={safePage}
                  totalPages={totalPages}
                  setPage={setPage}
                  setPageSize={setPageSize}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-border-base">
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
                      <SortableTh
                        label="SKU"
                        col="sku"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={onSortToggle}
                      />
                      <SortableTh
                        label="Brand"
                        col="brand"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={onSortToggle}
                      />
                      <SortableTh
                        label="Size"
                        col="size_label"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={onSortToggle}
                      />
                      <SortableTh
                        label="Format"
                        col="format"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={onSortToggle}
                      />
                      <SortableTh
                        label="DPI"
                        col="dpi"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={onSortToggle}
                      />
                      <SortableTh
                        label="Generated"
                        col="created_at"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={onSortToggle}
                      />
                      <SortableTh
                        label="Filename"
                        col="file_path"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={onSortToggle}
                      />
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
                          <td className="border-b border-border-subtle px-2 py-1.5">
                            <button
                              onClick={() => void onOpenProduct(f)}
                              className="font-mono text-accent hover:underline"
                              title="Open the product that generated this file"
                            >
                              {f.sku}
                            </button>
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
                                onClick={() =>
                                  setBatchFilter(f.batch_id ?? '')
                                }
                                title="Filter to this batch"
                                className="rounded px-1 py-0.5 hover:bg-bg-elevated hover:text-fg-base"
                              >
                                {new Date(f.created_at).toLocaleString()}
                              </button>
                            ) : (
                              <span>
                                {new Date(f.created_at).toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="border-b border-border-subtle px-2 py-1.5 max-w-[260px] truncate text-fg-muted">
                            <span className="flex items-center gap-1">
                              {!f.exists && (
                                <span title="File missing on disk">
                                  <IconAlertCircle
                                    size={12}
                                    className="text-warning"
                                  />
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
                                onClick={() =>
                                  window.api.export.openInOS(f.file_path)
                                }
                                className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base disabled:opacity-40"
                              >
                                <IconExternalLink size={12} />
                              </button>
                              <button
                                title="Reveal in Finder"
                                onClick={() =>
                                  window.api.export.revealInFinder(f.file_path)
                                }
                                className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
                              >
                                <IconFolderOpen size={12} />
                              </button>
                              <button
                                title="Open the source product"
                                onClick={() => void onOpenProduct(f)}
                                className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
                              >
                                <IconPackage size={12} />
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
                <PaginationFooter
                  start={safePage * pageSize}
                  pageSize={pageSize}
                  total={total}
                  safePage={safePage}
                  totalPages={totalPages}
                  setPage={setPage}
                  setPageSize={setPageSize}
                />
              </div>
            )}
          </main>
        </div>
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
            Removes <strong>{selected.size}</strong> entries from the file
            index. The files on disk will <strong>also be deleted</strong>.
            You can undo this from the toast that appears.
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

// ── Helpers + subcomponents ─────────────────────────────────────────────────

function filenameOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ── Storage stats card ─────────────────────────────────────────────────────

function StorageCard({
  stats,
}: {
  stats: Awaited<ReturnType<typeof window.api.files.storageStats>> | null;
}) {
  if (!stats) return null;
  if (stats.totalFiles === 0) return null;
  const formats: Array<['pdf' | 'png' | 'jpeg', string]> = [
    ['pdf', 'PDF'],
    ['png', 'PNG'],
    ['jpeg', 'JPEG'],
  ];
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md border border-border-base bg-bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <IconDatabase size={16} className="text-fg-subtle" />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle">
            Total
          </div>
          <div className="text-sm font-semibold text-fg-base">
            {stats.totalFiles.toLocaleString()} file
            {stats.totalFiles === 1 ? '' : 's'} · {formatBytes(stats.totalBytes)}
          </div>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-4 text-xs">
        {formats.map(([key, label]) => {
          const entry = stats.byFormat[key];
          if (!entry || entry.count === 0) return null;
          return (
            <div key={key}>
              <span className="text-fg-subtle">{label}:</span>{' '}
              <span className="font-medium text-fg-base">
                {entry.count.toLocaleString()}
              </span>
              <span className="text-fg-subtle"> · {formatBytes(entry.bytes)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sidebar list group ────────────────────────────────────────────────────

function FilterGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
        {icon}
        {label}
      </div>
      <div className="rounded-md border border-border-subtle bg-bg-surface p-1">
        {children}
      </div>
    </div>
  );
}

function SidebarItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
        active
          ? 'bg-bg-hover text-fg-base font-medium'
          : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ── View toggle button ─────────────────────────────────────────────────────

function ViewToggleBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-accent text-accent-fg'
          : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ── Sortable table header ──────────────────────────────────────────────────

function SortableTh({
  label,
  col,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onToggle: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  const Icon = !active
    ? IconSelector
    : sortDir === 'asc'
      ? IconChevronUp
      : IconChevronDown;
  return (
    <th className="px-2 py-2 text-left">
      <button
        onClick={() => onToggle(col)}
        className={[
          'inline-flex items-center gap-1 -mx-1 rounded px-1 py-0.5 transition-colors',
          active
            ? 'text-fg-base font-semibold'
            : 'text-fg-muted hover:text-fg-base',
        ].join(' ')}
        title={`Sort by ${label}`}
      >
        {label}
        <Icon
          size={12}
          stroke={2}
          className={active ? 'text-accent' : 'text-fg-subtle'}
        />
      </button>
    </th>
  );
}

// ── Pagination footer ──────────────────────────────────────────────────────

function PaginationFooter({
  start,
  pageSize,
  total,
  safePage,
  totalPages,
  setPage,
  setPageSize,
}: {
  start: number;
  pageSize: number;
  total: number;
  safePage: number;
  totalPages: number;
  setPage: (n: number) => void;
  setPageSize: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-fg-muted">
      <span>
        {total === 0
          ? 'No matches'
          : `Showing ${start + 1}–${Math.min(start + pageSize, total)} of ${total.toLocaleString()}`}
      </span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-fg-subtle">Per page</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
            className="rounded-md border border-border-base bg-bg-base px-1.5 py-1 text-[11px]"
          >
            {[25, 50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            disabled={safePage === 0}
            onClick={() => setPage(0)}
            className="rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-30"
            title="First page"
          >
            ⟪
          </button>
          <button
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className="rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-30"
          >
            ‹ Prev
          </button>
          <span className="px-2 font-mono">
            {safePage + 1} / {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
            className="rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-30"
          >
            Next ›
          </button>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            className="rounded px-2 py-1 hover:bg-bg-hover disabled:opacity-30"
            title="Last page"
          >
            ⟫
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────

function GridCard({
  file,
  assetsDir,
  brandColor,
  selected,
  onToggleSelect,
  onOpen,
  onReveal,
  onReprint,
  onDelete,
  onOpenProduct,
  onFilterBatch,
  reprinting,
}: {
  file: FileEntry;
  assetsDir: string | null;
  brandColor?: string;
  selected: boolean;
  onToggleSelect: (shift: boolean) => void;
  onOpen: () => void;
  onReveal: () => void;
  onReprint: () => void;
  onDelete: () => void;
  onOpenProduct: () => void;
  onFilterBatch: () => void;
  reprinting: boolean;
}) {
  // Build a renderable URL for raster formats. We piggyback the assets-dir
  // helper but it expects relative paths under the assets root — for files
  // outside that root (which is always the case for generated labels;
  // they go to the user's chosen output folder), construct a lskh-file://
  // URL from the absolute path directly. The custom protocol handler in
  // main/index.ts serves arbitrary file paths.
  const url =
    assetsDir && (file.format === 'png' || file.format === 'jpeg')
      ? `lskh-file://local${encodeURI(file.file_path)}`
      : null;

  return (
    <div
      className={[
        'group relative flex flex-col overflow-hidden rounded-md border bg-bg-surface text-left transition-colors',
        selected
          ? 'border-accent bg-accent/5'
          : 'border-border-base hover:bg-bg-hover',
      ].join(' ')}
    >
      {/* Click target = open file. The selection checkbox + action buttons
          live in absolute-positioned overlays so they don't trigger the
          parent click. */}
      <button
        onClick={onOpen}
        className="relative aspect-square w-full overflow-hidden bg-bg-elevated"
        title={file.exists ? 'Open file' : 'File missing on disk'}
        disabled={!file.exists}
      >
        {url && file.exists ? (
          <img
            src={url}
            alt={filenameOf(file.file_path)}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-fg-subtle">
            {file.format === 'pdf' ? (
              <IconFileTypePdf size={28} />
            ) : (
              <IconPhoto size={28} />
            )}
            <span className="text-[10px] uppercase">{file.format}</span>
            {!file.exists && (
              <span className="text-[10px] text-warning">missing on disk</span>
            )}
          </div>
        )}

        {/* Top-left: format pill */}
        <span className="absolute left-1 top-1 inline-flex items-center rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white backdrop-blur-sm">
          {file.format}
        </span>
        {/* Top-right: size pill */}
        <span className="absolute right-1 top-1 inline-flex items-center rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
          {file.size_label}
        </span>
      </button>

      {/* Footer */}
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          {brandColor && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: brandColor }}
            />
          )}
          <span className="truncate font-mono text-xs font-semibold text-fg-base">
            {file.sku}
          </span>
        </div>
        <div className="truncate text-[10px] text-fg-subtle">
          {file.brand_name ?? '—'} · {file.dpi} dpi
        </div>
        {file.batch_id && (
          <button
            onClick={onFilterBatch}
            className="mt-0.5 truncate text-[10px] text-fg-subtle hover:text-fg-base"
            title="Filter to this batch"
          >
            {new Date(file.created_at).toLocaleDateString()}
          </button>
        )}
      </div>

      {/* Selection checkbox (top-right of footer area for click safety) */}
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) =>
          onToggleSelect((e.nativeEvent as MouseEvent).shiftKey ?? false)
        }
        className="absolute right-1.5 top-1.5 z-10 cursor-pointer accent-accent opacity-0 transition-opacity group-hover:opacity-100 [&:checked]:opacity-100"
        aria-label={`Select ${file.sku}`}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Hover action row at bottom */}
      <div className="absolute inset-x-0 bottom-9 flex items-center justify-around gap-1 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-1 py-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onReveal}
          title="Reveal in Finder"
          className="rounded p-1 text-white hover:bg-white/20"
        >
          <IconFolderOpen size={12} />
        </button>
        <button
          onClick={onOpenProduct}
          title="Open the source product"
          className="rounded p-1 text-white hover:bg-white/20"
        >
          <IconPackage size={12} />
        </button>
        <button
          onClick={onReprint}
          disabled={reprinting}
          title="Reprint from snapshot"
          className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-40"
        >
          <IconRefresh size={12} />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="rounded p-1 text-white hover:bg-danger/80"
        >
          <IconTrash size={12} />
        </button>
      </div>
    </div>
  );
}
