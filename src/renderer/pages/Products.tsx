import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  IconPlus,
  IconSearch,
  IconBuildingStore,
  IconFolders,
  IconPackage,
  IconUpload,
  IconHistory,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useBrandStore } from '../stores/brandStore';
import { useProductStore } from '../stores/productStore';
import { useCompanyStore } from '../stores/companyStore';
import { useDefaultBrand } from '../hooks/useDefaultBrand';
import type { Product } from '../../shared/types/product';
import { ProductForm } from './products/ProductForm';
import { ImportFlow } from './dataImport/ImportFlow';
import { ImportHistory } from './dataImport/ImportHistory';

type ProductsTab = 'library' | 'import' | 'history';

// Mirrors spec §16 layout — sidebar (brand + category) + toolbar (search +
// new) + table + pagination footer. Phase 2 ships table view only; grid view,
// auto-match, import-modal, and download-sample come in later phases.

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

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
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Tab state, mirrored to ?tab= so links can deep-link to a specific tab
  // (e.g. the deprecated /data route can redirect into /products?tab=import).
  const urlTab = params.get('tab') as ProductsTab | null;
  const [tab, setTabState] = useState<ProductsTab>(
    urlTab && ['library', 'import', 'history'].includes(urlTab)
      ? urlTab
      : 'library',
  );
  const setTab = (t: ProductsTab) => {
    setTabState(t);
    const next = new URLSearchParams(params);
    if (t === 'library') next.delete('tab');
    else next.set('tab', t);
    setParams(next, { replace: true });
  };

  // First mount: load brands, default the brand filter to the user's last-
  // used (or first) brand, fetch categories + products. Spec §16 default
  // selection is "All brands" (undefined); we land on a specific brand
  // because every product in our app belongs to one, and showing the
  // cross-brand view as default would be noisier than useful.
  useEffect(() => {
    void refreshBrands();
  }, [refreshBrands]);

  useEffect(() => {
    const fromUrl = params.get('brand');
    const initial = fromUrl ?? defaultBrandId;
    if (initial && filters.brandId === undefined) {
      void setBrand(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBrandId, params]);

  // Reset to page 0 whenever filters change (spec §16: "page resets on filter
  // change"). Effect intentionally depends on filter fields, not the object,
  // so a reference swap with same values doesn't churn.
  useEffect(() => {
    setPage(0);
  }, [filters.brandId, filters.category, filters.search, filters.status, pageSize]);

  // Pagination math. Clamp page when products list shrinks (e.g. after a
  // delete) so we don't end up looking at an out-of-range page.
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const visible = useMemo(
    () => products.slice(start, start + pageSize),
    [products, start, pageSize],
  );

  const activeBrand = brands.find((b) => b.id === filters.brandId);

  const onPickBrand = (brandId: string) => {
    void setBrand(brandId);
    pickBrand(brandId);
  };

  return (
    <>
      <Page
        title="Product Library"
        actions={
          tab === 'library' ? (
            <Button
              variant="primary"
              onClick={() => setEditing('new')}
              disabled={!activeBrand}
              title={
                activeBrand
                  ? `Add a new product to ${activeBrand.name}`
                  : 'Pick a brand first'
              }
            >
              <IconPlus size={14} /> New product
            </Button>
          ) : undefined
        }
      >
        {/* Tab bar. Three top-level views on the products page: the
            library itself, the CSV/Excel import flow (previously at
            /data → Import), and the import history (previously at
            /data → History). Manual entry and SKU Lookup from /data
            are superseded by the Library tab itself. */}
        <div className="mb-4 flex gap-1 border-b border-border-base">
          <TabBtn active={tab === 'library'} onClick={() => setTab('library')}>
            <IconPackage size={13} /> Library
          </TabBtn>
          <TabBtn active={tab === 'import'} onClick={() => setTab('import')}>
            <IconUpload size={13} /> Import
          </TabBtn>
          <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>
            <IconHistory size={13} /> History
          </TabBtn>
        </div>

        {tab === 'import' ? (
          <ImportFlow />
        ) : tab === 'history' ? (
          <ImportHistory />
        ) : brands.length === 0 ? (
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
          <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-4">
            {/* Sidebar — brand + category filters */}
            <aside className="space-y-4">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
                  <IconBuildingStore size={11} /> Brand
                </div>
                <SidebarList>
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
            <main className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <div className="relative max-w-sm flex-1">
                  <IconSearch
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
                  />
                  <input
                    value={filters.search ?? ''}
                    onChange={(e) => void setSearch(e.target.value)}
                    placeholder="Search SKU, name, color, tags, barcode…"
                    className="h-9 w-full rounded-md border border-border-base bg-bg-surface pl-8 pr-3 text-sm text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
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
                <span className="ml-auto text-xs text-fg-muted">
                  {products.length === 0
                    ? 'No products match'
                    : `${products.length.toLocaleString()} product${products.length === 1 ? '' : 's'}`}
                </span>
              </div>

              {loading && products.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
                  Loading…
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
                  <h3 className="text-sm font-semibold text-fg-base">
                    No products yet for {activeBrand?.name ?? 'this brand'}
                  </h3>
                  <p className="mt-1 text-xs text-fg-muted">
                    Click "New product" to add one, or use the Data & Import
                    tab to bulk-import from a CSV.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border-base">
                  <table className="w-full text-xs">
                    <thead className="bg-bg-elevated text-fg-muted">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium">SKU</th>
                        <th className="px-2 py-2 text-left font-medium">Name</th>
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
                          onClick={() => setEditing(p)}
                          className="cursor-pointer hover:bg-bg-hover"
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
                          <td className="border-b border-border-subtle px-2 py-1.5 text-right text-fg-subtle">
                            Edit
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Pagination footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-fg-muted">
                    <span>
                      Showing {start + 1}–
                      {Math.min(start + pageSize, products.length)} of{' '}
                      {products.length.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1">
                        <span className="text-[10px] text-fg-subtle">Per page</span>
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                          className="rounded-md border border-border-base bg-bg-base px-1.5 py-1 text-[11px]"
                        >
                          {PAGE_SIZE_OPTIONS.map((n) => (
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
                </div>
              )}
            </main>
          </div>
        )}
      </Page>

      {editing !== null && activeBrand && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          defaultBrandId={activeBrand.id}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// ── Small subcomponents ─────────────────────────────────────────────────────

function TabBtn({
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
        '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
        active
          ? 'border-accent text-fg-base'
          : 'border-transparent text-fg-muted hover:text-fg-base',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

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
