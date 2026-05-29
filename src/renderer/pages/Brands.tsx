import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconPlus,
  IconSearch,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { BrandCardSkeletonGrid } from '../components/Skeleton';
import { useBrandStore } from '../stores/brandStore';
import { useCompanyStore } from '../stores/companyStore';
import { BrandFormModal } from '../components/BrandFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Brand } from '../../shared/types/brand';

// Renderer-side preview helper. Mirrors BrandFormModal so the card and
// the modal show the same image. (Custom protocol registered in main.)
function localFileUrl(path: string): string {
  const segments = path.split('/').map(encodeURIComponent).join('/');
  return `lskh-file://${segments}`;
}

function initialsFor(name: string): string {
  const stripped = name.replace(/[^A-Za-z0-9]/g, '');
  return (stripped.slice(0, 2) || 'BR').toUpperCase();
}

type WizardState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; brand: Brand };

export default function Brands() {
  const { t } = useTranslation();
  const { brands, loading, refresh, remove } = useBrandStore();
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const [wizard, setWizard] = useState<WizardState>({ mode: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<Brand | null>(null);
  const [query, setQuery] = useState('');
  const [productCounts, setProductCounts] = useState<Record<string, number>>(
    {},
  );
  const navigate = useNavigate();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Product counts grouped by brand_id — one IPC call covers every
  // card on the page. Refetches when the active company changes (the
  // user expects per-workspace numbers) and when the brand list does
  // (a delete or create can shift counts immediately).
  const brandKey = brands.map((b) => b.id).join(',');
  useEffect(() => {
    let cancelled = false;
    void window.api.products
      .countsByBrand(activeCompanyId ?? undefined)
      .then((counts) => {
        if (!cancelled) setProductCounts(counts);
      });
    return () => {
      cancelled = true;
    };
  }, [brandKey, activeCompanyId]);

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <Page
        title={t('brands.title')}
        subtitle="A company can carry one or many brands. Brands have an optional icon shown on product cards and exports."
        actions={
          <Button variant="primary" onClick={() => setWizard({ mode: 'create' })}>
            <IconPlus size={14} /> {t('brands.addBrand')}
          </Button>
        }
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <IconSearch
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('brands.searchPlaceholder')}
              className="h-9 w-full rounded-md border border-border-base bg-bg-surface pl-8 pr-3 text-sm text-fg-base placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <span className="text-xs text-fg-muted">
            {t('brands.brandCount', { count: brands.length })}
          </span>
        </div>

        {loading && brands.length === 0 ? (
          <BrandCardSkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState
            onAdd={() => setWizard({ mode: 'create' })}
            hasBrands={brands.length > 0}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((b) => (
              <BrandCard
                key={b.id}
                brand={b}
                productCount={productCounts[b.id] ?? 0}
                onOpenTemplates={() => navigate(`/templates?brand=${b.id}`)}
                onEdit={() => setWizard({ mode: 'edit', brand: b })}
                onDelete={() => setConfirmDelete(b)}
              />
            ))}
          </div>
        )}
      </Page>

      {wizard.mode !== 'closed' && (
        <BrandFormModal
          existing={wizard.mode === 'edit' ? wizard.brand : undefined}
          onClose={() => setWizard({ mode: 'closed' })}
          onSaved={(brandId) => {
            const wasCreate = wizard.mode === 'create';
            setWizard({ mode: 'closed' });
            // After create, jump into Templates pre-filtered to the new
            // brand so the user can keep momentum into "make a label".
            // Edit just closes (the card refresh picks up the change).
            if (wasCreate) {
              navigate(`/templates?brand=${brandId}&new=1`);
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={t('brands.delete.title', {
          name: confirmDelete?.name ?? t('brands.delete.fallbackName'),
        })}
        message={
          <>
            {t('brands.delete.messageLine1Pre')}
            <strong>{t('brands.delete.messageLine1Strong')}</strong>
            {t('brands.delete.messageLine1Post')}
            <br />
            <br />
            {t('brands.delete.messageLine2')}
          </>
        }
        confirmLabel={t('brands.delete.confirmLabel')}
        cancelLabel={t('brands.delete.cancelLabel')}
        tone="danger"
        onConfirm={async () => {
          if (!confirmDelete) return;
          await remove(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

// Brand card matches the Image Studio KH reference: large square logo
// area on the left, brand name + "N product(s)" below, Edit button at
// the bottom. Delete is hidden behind hover so the card stays calm by
// default. Whole card is clickable to jump into Templates.
function BrandCard({
  brand,
  productCount,
  onOpenTemplates,
  onEdit,
  onDelete,
}: {
  brand: Brand;
  productCount: number;
  onOpenTemplates: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const logoPath = brand.logos?.[0]?.path ?? brand.logoPath ?? null;
  return (
    <div className="group relative flex flex-col rounded-lg border border-border-base bg-bg-surface p-4 transition-colors hover:bg-bg-hover">
      <div className="flex items-start gap-4">
        {/* Logo area — large square, white background so dark logos
            read cleanly. Fallback when no image: brand-color square
            with two-letter initials, same treatment as the form
            modal's preview. */}
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-base bg-white"
          style={logoPath ? undefined : { background: brand.color }}
        >
          {logoPath ? (
            <img
              src={localFileUrl(logoPath)}
              alt={`${brand.name} logo`}
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="text-base font-bold text-white">
              {initialsFor(brand.name)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-fg-base">
            {brand.name}
          </div>
          <div className="mt-0.5 text-xs text-fg-muted">
            {productCount} {productCount === 1 ? 'product' : 'products'}
          </div>
          {brand.tagline && (
            <div className="mt-1 truncate text-[11px] text-fg-subtle">
              {brand.tagline}
            </div>
          )}
        </div>

        {/* Delete only on hover — keeps the resting state clean. */}
        <button
          onClick={onDelete}
          title={t('brands.card.deleteTitle')}
          className="absolute right-2 top-2 rounded p-1 text-fg-muted opacity-0 transition-opacity hover:bg-bg-elevated hover:text-danger group-hover:opacity-100"
        >
          <IconTrash size={13} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onEdit}>
          <IconPencil size={12} /> Edit
        </Button>
        <button
          onClick={onOpenTemplates}
          className="ml-auto text-[11px] text-fg-muted hover:text-fg-base"
        >
          {t('brands.card.openTemplates')} →
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd, hasBrands }: { onAdd: () => void; hasBrands: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-dashed border-border-base p-16 text-center">
      <h3 className="text-sm font-semibold text-fg-base">
        {hasBrands ? t('brands.emptySearch.title') : t('brands.empty.title')}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
        {hasBrands
          ? t('brands.emptySearch.description')
          : t('brands.empty.description')}
      </p>
      {!hasBrands && (
        <div className="mt-4 inline-block">
          <Button variant="primary" onClick={onAdd}>
            <IconPlus size={14} /> {t('brands.empty.cta')}
          </Button>
        </div>
      )}
    </div>
  );
}
