import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  IconPlus,
  IconSearch,
  IconBuildingStore,
  IconFolders,
  IconFileSpreadsheet,
  IconTable,
  IconLayoutGrid,
  IconPhotoSearch,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useBrandStore } from '../stores/brandStore';
import { useProductStore } from '../stores/productStore';
import { useCompanyStore } from '../stores/companyStore';
import { useDefaultBrand } from '../hooks/useDefaultBrand';
import { useAssetsDir, productImageUrl } from '../hooks/useAssetsDir';
import type { Product } from '../../shared/types/product';
import { ProductForm } from './products/ProductForm';
import { AutoMatchModal } from './products/AutoMatchModal';
import { ImportModalShell } from './products/ImportModalShell';
import { HistoryModalShell } from './products/HistoryModalShell';

type ProductsView = 'table' | 'grid';
type ProductsSort =
  | 'recent'
  | 'sku-asc'
  | 'sku-desc'
  | 'name-asc'
  | 'name-desc'
  | 'created-desc'
  | 'created-asc';

// Module-level guard so the auto-pick effect only fires once per app
// session — see the comment near its useEffect. Resetting requires a
// full app reload, which is what we want: the user's "All brands"
// choice should survive normal navigation between modules.
let productsBrandInitialized = false;

// Persistence helpers for the Library's table/grid + side-panel
// preferences. Each survives navigation away and back (the page
// re-mounts, so component state is lost) but doesn't need a full
// settings.json round-trip. Mirrors Image Studio KH's pattern.
const VIEW_STORAGE_KEY = 'lskh.products.view';
const PANEL_STORAGE_KEY = 'lskh.products.panel';
const SORT_STORAGE_KEY = 'lskh.products.sort';

function loadView(): ProductsView {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === 'table' || v === 'grid') return v;
  } catch {
    /* ignore */
  }
  return 'table';
}
function loadPanelVisible(): boolean {
  try {
    const v = localStorage.getItem(PANEL_STORAGE_KEY);
    if (v === 'on') return true;
    if (v === 'off') return false;
  } catch {
    /* ignore */
  }
  // First-load default: ON when the viewport can comfortably fit the
  // sidebar (200) + table + panel (420). Below ~1400 the layout feels
  // squashed, so default to OFF and let the user opt in.
  try {
    return window.innerWidth >= 1400;
  } catch {
    return true;
  }
}
function loadSort(): ProductsSort {
  try {
    const v = localStorage.getItem(SORT_STORAGE_KEY);
    if (
      v === 'recent' ||
      v === 'sku-asc' ||
      v === 'sku-desc' ||
      v === 'name-asc' ||
      v === 'name-desc' ||
      v === 'created-desc' ||
      v === 'created-asc'
    )
      return v;
  } catch {
    /* ignore */
  }
  return 'recent';
}

const SORT_OPTIONS: ReadonlyArray<{ value: ProductsSort; label: string }> = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'created-desc', label: 'Recently added' },
  { value: 'created-asc', label: 'Oldest added' },
  { value: 'sku-asc', label: 'Product Code A→Z' },
  { value: 'sku-desc', label: 'Product Code Z→A' },
  { value: 'name-asc', label: 'Name A→Z' },
  { value: 'name-desc', label: 'Name Z→A' },
];

// (Page-size options live inline in PaginationFooter — defined locally there
// since both the table and grid views render the same footer.)

// Mirrors spec §16 layout — sidebar (brand + category) + toolbar (search +
// new) + table + pagination footer. Phase 2 ships table view only; grid view,
// auto-match, import-modal, and download-sample come in later phases.


export default function Products() {
  const { brands, refresh: refreshBrands } = useBrandStore();
  const { defaultBrandId, pickBrand } = useDefaultBrand();
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const products = useProductStore((s) => s.products);
  const categoriesAll = useProductStore((s) => s.categoriesAll);
  const loading = useProductStore((s) => s.loading);
  const filters = useProductStore((s) => s.filters);
  const setBrand = useProductStore((s) => s.setBrand);
  const setCategory = useProductStore((s) => s.setCategory);
  const setSearch = useProductStore((s) => s.setSearch);
  const setCompany = useProductStore((s) => s.setCompany);
  const refreshProducts = useProductStore((s) => s.refreshProducts);
  const refreshCategories = useProductStore((s) => s.refreshCategories);

  // Scope products + categories to the active company. Cross-store coupling
  // is one-way: companyStore.setActive → here, here triggers product refresh.
  useEffect(() => {
    if (activeCompanyId) void setCompany(activeCompanyId);
  }, [activeCompanyId, setCompany]);

  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Product | null | 'new'>(null);
  // Row-level delete: opening this sets the product to delete; the
  // ConfirmDialog below shows the SKU + warning and calls removeProduct
  // (hard DELETE on the skus row in SQLite). Lives at page-level rather
  // than per-row so the dialog is mounted once.
  const [confirmDeleteProduct, setConfirmDeleteProduct] =
    useState<Product | null>(null);
  const removeProduct = useProductStore((s) => s.removeProduct);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  // View toggle + side-panel visibility + sort — all seeded from
  // localStorage so the user's choices survive normal navigation. The
  // panel default depends on viewport width (see loadPanelVisible).
  const [view, setViewRaw] = useState<ProductsView>(loadView);
  const setView = (v: ProductsView) => {
    setViewRaw(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const [panelVisible, setPanelVisibleRaw] = useState<boolean>(loadPanelVisible);
  const togglePanel = () => {
    setPanelVisibleRaw((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PANEL_STORAGE_KEY, next ? 'on' : 'off');
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const [sort, setSortRaw] = useState<ProductsSort>(loadSort);
  const setSort = (s: ProductsSort) => {
    setSortRaw(s);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, s);
    } catch {
      /* ignore */
    }
  };
  const [autoMatchOpen, setAutoMatchOpen] = useState(false);
  const activeCompany = useCompanyStore(
    (s) => s.companies.find((c) => c.id === s.activeCompanyId) ?? null,
  );
  const assetsDir = useAssetsDir();

  // Import + History live as MODALS now (Image Studio KH parity — no tabs
  // on the Library page). The `?tab=` URL param is still consumed for
  // back-compat: legacy /data route still redirects to /products?tab=import
  // and "View in Library" deep-links pre-0.7.x may include it. Both map
  // to "open the import modal." The param is stripped after consumption.
  const [importOpen, setImportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    const t = params.get('tab');
    if (t === 'import') {
      setImportOpen(true);
      const next = new URLSearchParams(params);
      next.delete('tab');
      setParams(next, { replace: true });
    } else if (t === 'history') {
      setHistoryOpen(true);
      const next = new URLSearchParams(params);
      next.delete('tab');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // First mount: load brands, default the brand filter to the user's last-
  // used (or first) brand, fetch categories + products. Spec §16 default
  // selection is "All brands" (undefined); we land on a specific brand
  // because every product in our app belongs to one, and showing the
  // cross-brand view as default would be noisier than useful.
  useEffect(() => {
    void refreshBrands();
  }, [refreshBrands]);

  // Brand-filter initialization. Only auto-pick a brand when:
  //   (a) the URL says so (?brand=<id> — deep-link from File Manager / Brand
  //       card / "View in Library" CTA after import), OR
  //   (b) this is the very first mount of the session AND no brand has been
  //       explicitly cleared. We track "first mount" with a module-level
  //       guard so navigating to /generate and back doesn't undo the user's
  //       "All brands" choice.
  // Previously this effect auto-picked `defaultBrandId` on every mount, which
  // made it impossible to ever see products from more than one brand at once —
  // clicking "All brands" would visibly clear, then re-fill on next nav.
  useEffect(() => {
    const fromUrl = params.get('brand');
    if (fromUrl) {
      void setBrand(fromUrl);
      productsBrandInitialized = true;
      return;
    }
    if (!productsBrandInitialized && defaultBrandId && filters.brandId === undefined) {
      void setBrand(defaultBrandId);
      productsBrandInitialized = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBrandId, params]);

  // Deep-link: /products?edit=<productId> opens the edit modal for that
  // product on mount. Used by the File Manager's "View product" action so
  // a file row can jump to the product that generated it. We strip the
  // param after consuming it so back/forward doesn't keep re-opening.
  useEffect(() => {
    const editId = params.get('edit');
    if (!editId || editing !== null) return;
    void window.api.products.get(editId).then((p) => {
      if (p) setEditing(p);
      const next = new URLSearchParams(params);
      next.delete('edit');
      setParams(next, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Reset to page 0 whenever filters change (spec §16: "page resets on filter
  // change"). Effect intentionally depends on filter fields, not the object,
  // so a reference swap with same values doesn't churn.
  useEffect(() => {
    setPage(0);
  }, [filters.brandId, filters.category, filters.search, filters.status, pageSize]);

  // Client-side sort applied to the products list before pagination. The
  // DB returns rows in `updated_at DESC` order already (matches the
  // default "Recently updated" sort), so flipping headers in the UI
  // re-sorts in-memory without an IPC round-trip. `localeCompare` with
  // `numeric: true` is used for Product Code so codes like "MR-001",
  // "MR-12", "MR-2" sort the way a human reads them.
  const sortedProducts = useMemo(() => {
    if (sort === 'recent') return products;
    const arr = products.slice();
    const cmp = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    switch (sort) {
      case 'sku-asc':
        return arr.sort((a, b) => cmp(a.sku ?? '', b.sku ?? ''));
      case 'sku-desc':
        return arr.sort((a, b) => -cmp(a.sku ?? '', b.sku ?? ''));
      case 'name-asc':
        return arr.sort((a, b) => cmp(a.name ?? '', b.name ?? ''));
      case 'name-desc':
        return arr.sort((a, b) => -cmp(a.name ?? '', b.name ?? ''));
      case 'created-desc':
        return arr.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      case 'created-asc':
        return arr.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
      default:
        return arr;
    }
  }, [products, sort]);

  // Pagination math. Clamp page when products list shrinks (e.g. after a
  // delete) so we don't end up looking at an out-of-range page.
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const visible = useMemo(
    () => sortedProducts.slice(start, start + pageSize),
    [sortedProducts, start, pageSize],
  );

  const activeBrand = brands.find((b) => b.id === filters.brandId);

  // The product currently shown in the side panel — used to highlight its
  // row/card in the table/grid so the user can see at a glance which item
  // they're editing. null when creating-new or nothing is selected.
  const selectedProductId =
    editing && editing !== 'new' ? editing.id : null;

  // Wrapped row-click handler — sets the editing product AND force-shows
  // the panel if it's hidden. Without this, clicking a row with the panel
  // off feels like a no-op. Image Studio KH has the same fail-safe.
  const openProductInPanel = (p: Product) => {
    setEditing(p);
    if (!panelVisible) togglePanel();
  };

  const onPickBrand = (brandId: string) => {
    void setBrand(brandId);
    pickBrand(brandId);
  };

  return (
    <>
      <Page title="Product Library">
        {/* Tabs were removed in 0.7.1 to match Image Studio KH's single-
            page Library layout. Import and History live as modals now
            (Image Studio KH parity), opened from toolbar buttons. */}
        {brands.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
            <h3 className="text-sm font-semibold text-fg-base">
              Create a brand first
            </h3>
            <p className="mt-1 text-xs text-fg-muted">
              Products belong to brands. Create a brand on the Brands page,
              then come back here.
            </p>
          </div>
        ) : (
          <div
            className={[
              'grid h-full gap-4 overflow-hidden',
              // Three columns when the side panel is on (filters | main |
              // panel). Two columns when it's off (filters | main). The panel
              // width (440px) matches Image Studio KH's reference.
              // `h-full overflow-hidden` makes the grid fill the page body
              // exactly so it never pushes the page to scroll — each column
              // owns its own vertical scroll instead (see min-h-0 + overflow
              // on the aside / main / panel below). This is what stops the
              // product grid from scrolling when you scroll the edit panel.
              panelVisible
                ? 'grid-cols-[200px_minmax(0,1fr)_440px]'
                : 'grid-cols-[200px_minmax(0,1fr)]',
            ].join(' ')}
          >
            {/* Sidebar — brand + category filters. min-h-0 + overflow-y-auto
                so a long brand/category list scrolls inside the column
                rather than growing the page. */}
            <aside className="scrollbar-thin min-h-0 space-y-4 overflow-y-auto">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
                  <IconBuildingStore size={11} /> Brand
                </div>
                <SidebarList>
                  {/* "All brands" sits at the top of the list, active
                      when no brand filter is set. Lets users see every
                      product in the active company — critical after a
                      CSV import that touches multiple brands, or when
                      looking for a SKU but unsure which brand it's
                      under. Matches Image Studio KH's pattern. */}
                  <SidebarItem
                    active={!filters.brandId}
                    onClick={() => void setBrand(undefined)}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded border border-border-base bg-bg-elevated" />
                    <span className="truncate">All brands</span>
                  </SidebarItem>
                  {brands.map((b) => (
                    <SidebarItem
                      key={b.id}
                      active={filters.brandId === b.id}
                      onClick={() => onPickBrand(b.id)}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded border border-border-base"
                        style={{ background: b.color }}
                      />
                      <span className="truncate">{b.name}</span>
                    </SidebarItem>
                  ))}
                </SidebarList>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
                  <IconFolders size={11} /> Category
                </div>
                <SidebarList>
                  <SidebarItem
                    active={!filters.category}
                    onClick={() => void setCategory(null)}
                  >
                    <span className="truncate">All categories</span>
                  </SidebarItem>
                  {categoriesAll.map((c) => (
                    <SidebarItem
                      key={c}
                      active={filters.category === c}
                      onClick={() => void setCategory(c)}
                    >
                      <span className="truncate">{c}</span>
                    </SidebarItem>
                  ))}
                  {categoriesAll.length === 0 && (
                    <div className="px-2 py-1.5 text-[10px] text-fg-subtle">
                      No categories yet.
                    </div>
                  )}
                </SidebarList>
              </div>
            </aside>

            {/* Main — toolbar + table + pagination */}
            <main className="flex min-h-0 min-w-0 flex-col">
              {/* Toolbar — two rows so the search field always has room.
                  Row 1: search (grows) + count. Row 2: actions. Both stay
                  fixed at the top of the column (shrink-0); only the content
                  below scrolls. Previously everything shared one wrapping
                  row and the search collapsed to a sliver on narrow widths. */}
              <div className="mb-3 shrink-0 space-y-2">
                {/* Row 1 — search + result count */}
                <div className="flex items-center gap-3">
                  <div className="relative min-w-0 flex-1">
                    <IconSearch
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
                    />
                    <input
                      value={filters.search ?? ''}
                      onChange={(e) => void setSearch(e.target.value)}
                      placeholder="Search product code, name, color, tags, barcode…"
                      className="h-9 w-full rounded-md border border-border-base bg-bg-surface pl-8 pr-3 text-sm text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  {/* Count + filter-state indicator. "(filtered)" appears
                      when any of search / brand / category is active. */}
                  <span className="shrink-0 whitespace-nowrap text-xs text-fg-muted">
                    {products.length === 0
                      ? 'No products match'
                      : (() => {
                          const hasFilter =
                            !!filters.search ||
                            !!filters.brandId ||
                            !!filters.category;
                          return `${products.length.toLocaleString()} product${products.length === 1 ? '' : 's'}${hasFilter ? ' (filtered)' : ''}`;
                        })()}
                  </span>
                </div>

                {/* Row 2 — actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* + New product — primary CTA. Force-shows the side panel
                      so clicking it with the panel hidden isn't a no-op. */}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setEditing('new');
                      if (!panelVisible) togglePanel();
                    }}
                    disabled={!activeBrand}
                    title={
                      activeBrand
                        ? `Add a new product to ${activeBrand.name}`
                        : 'Pick a brand first'
                    }
                  >
                    <IconPlus size={13} /> New product
                  </Button>

                  {/* Table / Grid toggle */}
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
                      title="Grid view"
                    >
                      <IconLayoutGrid size={13} /> Grid
                    </ViewToggleBtn>
                  </div>

                  {/* Panel-visibility toggle. */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={togglePanel}
                    title={
                      panelVisible
                        ? 'Hide product side panel'
                        : 'Show product side panel'
                    }
                    aria-pressed={panelVisible}
                  >
                    {panelVisible ? '◧ Panel on' : '◧ Panel off'}
                  </Button>

                  {/* Sort dropdown — client-side, applied via useMemo. */}
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as ProductsSort)}
                    title="Sort"
                    className="h-8 rounded-md border border-border-base bg-bg-surface px-2 text-xs text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setAutoMatchOpen(true)}
                    disabled={!activeCompany}
                    title={
                      activeCompany
                        ? 'Pick a folder of images named by SKU; the app auto-attaches them to matching products'
                        : 'Pick a company first'
                    }
                  >
                    <IconPhotoSearch size={13} /> Auto-match images…
                  </Button>

                  {/* Import Excel/CSV — opens the 4-step wizard in a modal. */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setImportOpen(true)}
                    title="Import products from an Excel or CSV file"
                  >
                    <IconFileSpreadsheet size={13} /> Import Excel/CSV
                  </Button>

                  {/* Refresh — re-fetch products + categories. (Import
                      history + the full audit log moved to the History
                      page in the sidebar's SYSTEM section.) */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void refreshProducts();
                      void refreshCategories();
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Scrollable content area — table/grid + pagination scroll
                  here, independently of the side panel and the filters
                  column. */}
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
              {loading && products.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
                  Loading…
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
                  <h3 className="text-sm font-semibold text-fg-base">
                    {activeBrand
                      ? `No products yet for ${activeBrand.name}`
                      : filters.search
                        ? 'No products match your search'
                        : 'No products in this workspace yet'}
                  </h3>
                  <p className="mt-1 text-xs text-fg-muted">
                    {filters.search
                      ? 'Try clearing the search, switching to "All brands", or removing the category filter.'
                      : 'Click "New product" to add one, or use the Import tab to bulk-import from a CSV.'}
                  </p>
                </div>
              ) : view === 'grid' ? (
                <div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {visible.map((p) => (
                      <GridCard
                        key={p.id}
                        product={p}
                        brand={brands.find((b) => b.id === p.brandId) ?? null}
                        assetsDir={assetsDir}
                        selected={p.id === selectedProductId}
                        onClick={() => openProductInPanel(p)}
                        onDelete={() => setConfirmDeleteProduct(p)}
                      />
                    ))}
                  </div>
                  {/* Same pagination footer as the table view. */}
                  <PaginationFooter
                    start={start}
                    pageSize={pageSize}
                    total={products.length}
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
                        <th className="px-2 py-2 text-left font-medium">Product Code</th>
                        <th className="px-2 py-2 text-left font-medium">Product Name</th>
                        <th className="px-2 py-2 text-left font-medium">Category</th>
                        <th className="px-2 py-2 text-left font-medium">Color / Finish</th>
                        <th className="px-2 py-2 text-right font-medium">Prices</th>
                        <th className="px-2 py-2 text-left font-medium">Status</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => openProductInPanel(p)}
                          className={[
                            'cursor-pointer',
                            // Selected row gets an accent-tinted background +
                            // a left accent bar so it's obvious which product
                            // the side panel is editing.
                            p.id === selectedProductId
                              ? 'bg-accent/10 hover:bg-accent/15'
                              : 'hover:bg-bg-hover',
                          ].join(' ')}
                          style={
                            p.id === selectedProductId
                              ? { boxShadow: 'inset 3px 0 0 0 rgb(var(--accent))' }
                              : undefined
                          }
                        >
                          <td className="border-b border-border-subtle px-2 py-1.5 font-mono">
                            {p.sku}
                          </td>
                          <td className="border-b border-border-subtle px-2 py-1.5">
                            {p.name ?? <span className="text-fg-subtle">—</span>}
                          </td>
                          <td className="border-b border-border-subtle px-2 py-1.5 text-fg-muted">
                            {p.category ?? <span className="text-fg-subtle">—</span>}
                          </td>
                          <td className="border-b border-border-subtle px-2 py-1.5 text-fg-muted">
                            {p.colorFinish ?? <span className="text-fg-subtle">—</span>}
                          </td>
                          <td className="border-b border-border-subtle px-2 py-1.5 text-right font-mono text-fg-muted">
                            <PricesSummary prices={p.prices} />
                          </td>
                          <td className="border-b border-border-subtle px-2 py-1.5">
                            <StatusPill status={p.status} />
                          </td>
                          <td className="border-b border-border-subtle px-2 py-1.5 text-right">
                            {/* Row actions. stopPropagation so the buttons
                                don't also trigger the row's click-to-edit. */}
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openProductInPanel(p);
                                }}
                                title="Edit product"
                                className="rounded p-1 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
                              >
                                <IconPencil size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteProduct(p);
                                }}
                                title="Delete product"
                                className="rounded p-1 text-fg-muted hover:bg-bg-elevated hover:text-danger"
                              >
                                <IconTrash size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <PaginationFooter
                    start={start}
                    pageSize={pageSize}
                    total={products.length}
                    safePage={safePage}
                    totalPages={totalPages}
                    setPage={setPage}
                    setPageSize={setPageSize}
                  />
                </div>
              )}
              </div>
            </main>

            {/* Right column — Product details side panel. Always mounted
                when panelVisible is true (per Image Studio KH's pattern)
                with three internal modes: empty placeholder when nothing
                is selected, blank form when isCreating, edit form when a
                product is selected. */}
            {panelVisible && (() => {
              const isNew = editing === 'new';
              const editingProduct = isNew ? null : editing;
              // Default brand for the new-product form: the sidebar-active
              // brand if there is one, otherwise the first brand of the
              // active company. Falling back to '' (which makes the SKU
              // input disabled) is fine because the form's Brand select
              // shows the available brands and gates Save on a valid pick.
              const defaultBrand =
                editingProduct?.brandId ?? activeBrand?.id ?? brands[0]?.id ?? '';
              return (
                <ProductForm
                  product={editingProduct}
                  isCreating={isNew}
                  defaultBrandId={defaultBrand}
                  onClose={() => setEditing(null)}
                  onStartCreate={
                    activeBrand || brands[0]
                      ? () => setEditing('new')
                      : undefined
                  }
                />
              );
            })()}
          </div>
        )}
      </Page>

      {autoMatchOpen && activeCompany && (
        <AutoMatchModal
          companyId={activeCompany.id}
          onClose={() => setAutoMatchOpen(false)}
        />
      )}

      {/* Import wizard + History — both opened from the Library toolbar.
          Mounted at page level so they survive sort/filter changes on
          the Library and so their `?tab=` back-compat auto-open works. */}
      <ImportModalShell
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onOpenHistory={() => {
          setImportOpen(false);
          setHistoryOpen(true);
        }}
        onViewInLibrary={(brandId) => {
          setImportOpen(false);
          // Apply the imported brand to the Library filter — the user
          // wants to see the rows they just added. null brandId is OK
          // (means leave "All brands" selected).
          if (brandId) void setBrand(brandId);
        }}
      />
      <HistoryModalShell
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      {/* Page-level confirm for row-level deletes. ProductService.remove
          runs `DELETE FROM skus WHERE id = ?` — a true hard-delete (no
          tombstone). The dialog spells that out so the user doesn't
          expect an undo. Re-importing the same CSV row will recreate it
          via bulkUpsert, which is what people sometimes confuse with
          "products keep coming back". */}
      <ConfirmDialog
        open={!!confirmDeleteProduct}
        title={
          confirmDeleteProduct
            ? `Delete ${confirmDeleteProduct.sku}?`
            : 'Delete product?'
        }
        message={
          <>
            Permanently removes{' '}
            <strong>
              {confirmDeleteProduct?.sku}
              {confirmDeleteProduct?.name ? ` — ${confirmDeleteProduct.name}` : ''}
            </strong>{' '}
            from the product database.
            <br />
            <br />
            Generated labels already on disk are unaffected, but they'll no
            longer link back to a product in this app.
            <br />
            <br />
            <span className="text-fg-subtle">
              Heads up: if this product came from a CSV import, re-importing
              the same file will re-create it.
            </span>
            <br />
            <br />
            This cannot be undone.
          </>
        }
        confirmLabel="Delete product"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={async () => {
          if (!confirmDeleteProduct) return;
          await removeProduct(confirmDeleteProduct.id);
          setConfirmDeleteProduct(null);
        }}
        onCancel={() => setConfirmDeleteProduct(null)}
      />
    </>
  );
}

// ── Small subcomponents ─────────────────────────────────────────────────────

function SidebarList({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface p-1">
      {children}
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

function PricesSummary({
  prices,
}: {
  prices: Record<string, number | string>;
}) {
  const entries = Object.entries(prices);
  if (entries.length === 0) return <span className="text-fg-subtle">—</span>;
  return (
    <span className="flex justify-end gap-2 text-[10px]">
      {entries.slice(0, 2).map(([k, v]) => (
        <span key={k}>
          <span className="text-fg-subtle">{k}:</span> {v}
        </span>
      ))}
    </span>
  );
}

function StatusPill({ status }: { status: 'active' | 'inactive' | 'draft' }) {
  const tone =
    status === 'active'
      ? 'bg-success/15 text-success'
      : status === 'inactive'
        ? 'bg-fg-subtle/15 text-fg-muted'
        : 'bg-warning/15 text-warning';
  return (
    <span
      className={['inline-block rounded px-1.5 py-0.5 text-[10px] font-medium', tone].join(
        ' ',
      )}
    >
      {status}
    </span>
  );
}

// ── View toggle (Table | Grid) ───────────────────────────────────────────────

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

// ── Grid card ───────────────────────────────────────────────────────────────

function GridCard({
  product,
  brand,
  assetsDir,
  selected,
  onClick,
  onDelete,
}: {
  product: Product;
  brand: { id: string; name: string; color: string } | null;
  assetsDir: string | null;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const mainImage = product.images[0];
  const url = mainImage ? productImageUrl(assetsDir, mainImage) : null;

  return (
    // Was a <button> wrapping everything — switched to a <div> so the
    // delete icon nested inside isn't an invalid <button>-in-<button>.
    // Click-to-edit moved to the same div via the outer onClick.
    <div
      onClick={onClick}
      className={[
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-md border text-left transition-colors',
        // Selected card gets an accent ring + tint so it's obvious which
        // product the side panel is editing.
        selected
          ? 'border-accent bg-accent/10 ring-1 ring-accent'
          : 'border-border-base bg-bg-surface hover:bg-bg-hover',
      ].join(' ')}
    >
      {/* Delete icon — top-right of the card, only visible on hover so it
          doesn't compete visually with the brand chip. stopPropagation
          prevents the card's edit-on-click. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete product"
        className="absolute right-1 top-1 z-10 rounded bg-bg-surface/80 p-1 text-fg-muted opacity-0 backdrop-blur-sm transition-opacity hover:text-danger group-hover:opacity-100"
      >
        <IconTrash size={12} />
      </button>
      <div className="relative aspect-square w-full overflow-hidden bg-bg-elevated">
        {url ? (
          <img
            src={url}
            alt={product.sku}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-fg-subtle">
            no image
          </div>
        )}
        {brand && (
          <span
            className="absolute right-1 top-1 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm"
            title={brand.name}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: brand.color }}
            />
            {brand.name}
          </span>
        )}
        {product.status !== 'active' && (
          <span
            className={[
              'absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-medium',
              product.status === 'draft'
                ? 'bg-warning/80 text-white'
                : 'bg-fg-subtle/70 text-white',
            ].join(' ')}
          >
            {product.status}
          </span>
        )}
      </div>
      <div className="px-2 py-1.5">
        <div className="truncate font-mono text-xs font-semibold text-fg-base">
          {product.sku}
        </div>
        <div className="truncate text-[11px] text-fg-muted">
          {product.name ?? '—'}
        </div>
        {product.colorFinish && (
          <div className="truncate text-[10px] text-fg-subtle">
            {product.colorFinish}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pagination footer (shared by table + grid) ──────────────────────────────

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
        Showing {start + 1}–{Math.min(start + pageSize, total)} of{' '}
        {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-fg-subtle">Per page</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
            className="rounded-md border border-border-base bg-bg-base px-1.5 py-1 text-[11px]"
          >
            {[25, 50, 100, 200].map((n) => (
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
