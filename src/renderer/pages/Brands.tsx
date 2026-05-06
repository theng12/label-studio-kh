import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconPlus,
  IconSearch,
  IconPencil,
  IconTrash,
  IconArrowRight,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useBrandStore } from '../stores/brandStore';
import { NewBrandWizard } from '../components/NewBrandWizard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Brand } from '../../shared/types/brand';

type WizardState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; brand: Brand };

export default function Brands() {
  const { brands, loading, refresh, remove } = useBrandStore();
  const [wizard, setWizard] = useState<WizardState>({ mode: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<Brand | null>(null);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <Page
        title="Brands"
        actions={
          <Button variant="primary" onClick={() => setWizard({ mode: 'create' })}>
            <IconPlus size={14} /> Add brand
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
              placeholder="Search brands…"
              className="h-9 w-full rounded-md border border-border-base bg-bg-surface pl-8 pr-3 text-sm text-fg-base placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <span className="text-xs text-fg-muted">
            {brands.length} {brands.length === 1 ? 'brand' : 'brands'}
          </span>
        </div>

        {loading ? (
          <div className="rounded-lg border border-dashed border-border-base p-12 text-center text-sm text-fg-muted">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            onAdd={() => setWizard({ mode: 'create' })}
            hasBrands={brands.length > 0}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <BrandCard
                key={b.id}
                brand={b}
                onOpenTemplates={() => navigate(`/templates?brand=${b.id}`)}
                onEdit={() => setWizard({ mode: 'edit', brand: b })}
                onDelete={() => setConfirmDelete(b)}
              />
            ))}
          </div>
        )}
      </Page>

      {wizard.mode !== 'closed' && (
        <NewBrandWizard
          existing={wizard.mode === 'edit' ? wizard.brand : undefined}
          onClose={() => setWizard({ mode: 'closed' })}
          onCreated={(brandId) => {
            const wasCreate = wizard.mode === 'create';
            setWizard({ mode: 'closed' });
            if (wasCreate) {
              navigate(`/templates?brand=${brandId}&new=1`);
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={`Delete ${confirmDelete?.name ?? 'brand'}?`}
        message={
          <>
            This removes the brand from your library. <strong>Templates and
            generated label files for this brand are not deleted</strong> from disk
            — they stay where they are, but they'll no longer be linked to a brand
            in this app.
            <br />
            <br />
            This cannot be undone.
          </>
        }
        confirmLabel="Delete brand"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={async () => {
          if (confirmDelete) {
            await remove(confirmDelete.id);
            setConfirmDelete(null);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

function BrandCard({
  brand,
  onOpenTemplates,
  onEdit,
  onDelete,
}: {
  brand: Brand;
  onOpenTemplates: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-start gap-3 rounded-lg border border-border-base bg-bg-surface p-4 transition-colors hover:bg-bg-hover">
      <div
        className="mt-1 h-6 w-6 shrink-0 rounded border border-border-base"
        style={{ background: brand.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-fg-base">
              {brand.name}
            </div>
            {brand.tagline && (
              <div className="mt-0.5 truncate text-xs text-fg-muted">
                {brand.tagline}
              </div>
            )}
            <div className="mt-2 text-xs text-fg-subtle">
              {brand.category ?? 'Uncategorised'}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={onEdit}
              title="Edit brand"
              className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
            >
              <IconPencil size={14} />
            </button>
            {!brand.isDemo && (
              <button
                onClick={onDelete}
                title="Delete brand"
                className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-danger"
              >
                <IconTrash size={14} />
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onOpenTemplates}
          className="mt-3 flex w-full items-center justify-between rounded border border-border-subtle px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-base"
        >
          <span>Open templates</span>
          <IconArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd, hasBrands }: { onAdd: () => void; hasBrands: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-border-base p-16 text-center">
      <h3 className="text-sm font-semibold text-fg-base">
        {hasBrands ? 'No brands match your search' : 'No brands yet'}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
        {hasBrands
          ? 'Try a different search term, or clear the search box.'
          : 'Brands hold your logo, color, address, and certifications. Each brand can have many templates.'}
      </p>
      {!hasBrands && (
        <div className="mt-4 inline-block">
          <Button variant="primary" onClick={onAdd}>
            <IconPlus size={14} /> Create your first brand
          </Button>
        </div>
      )}
    </div>
  );
}
