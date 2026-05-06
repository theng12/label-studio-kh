import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { useBrandStore } from '../stores/brandStore';
import { NewBrandWizard } from '../components/NewBrandWizard';

export default function Brands() {
  const { brands, loading, refresh } = useBrandStore();
  const [wizardOpen, setWizardOpen] = useState(false);
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
          <Button variant="primary" onClick={() => setWizardOpen(true)}>
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
          <EmptyState onAdd={() => setWizardOpen(true)} hasBrands={brands.length > 0} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <button
                key={b.id}
                onClick={() => navigate(`/templates?brand=${b.id}`)}
                className="flex items-start gap-3 rounded-lg border border-border-base bg-bg-surface p-4 text-left transition-colors hover:bg-bg-hover"
              >
                <div
                  className="mt-1 h-6 w-6 shrink-0 rounded border border-border-base"
                  style={{ background: b.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-fg-base">
                    {b.name}
                  </div>
                  {b.tagline && (
                    <div className="mt-0.5 truncate text-xs text-fg-muted">
                      {b.tagline}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-fg-subtle">
                    {b.category ?? 'Uncategorised'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Page>

      {wizardOpen && (
        <NewBrandWizard
          onClose={() => setWizardOpen(false)}
          onCreated={(brandId) => {
            setWizardOpen(false);
            navigate(`/templates?brand=${brandId}&new=1`);
          }}
        />
      )}
    </>
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
