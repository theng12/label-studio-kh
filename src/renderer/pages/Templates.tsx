import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconPlus,
  IconPencil,
  IconCopy,
  IconTrash,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TemplateCardSkeletonGrid } from '../components/Skeleton';
import { useBrandStore } from '../stores/brandStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useDefaultBrand } from '../hooks/useDefaultBrand';
import { toast } from '../components/Toast';
import type { Template } from '../../shared/types/template';

export default function Templates() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { brands, loading: brandsLoading, refresh } = useBrandStore();
  const refreshSettings = useSettingsStore((s) => s.refresh);
  const { visibleBrands, defaultBrandId, pickBrand } = useDefaultBrand();
  // The brand FILTER. null = "All brands" (the default — show every
  // template across every brand so users see their whole library at a
  // glance). A specific id narrows to that brand's templates.
  const [filterBrandId, setFilterBrandIdState] = useState<string | null>(
    params.get('brand'),
  );
  const setFilterBrandId = (id: string | null) => {
    setFilterBrandIdState(id);
    if (id) pickBrand(id);
  };
  // ALL templates across all brands, each carrying its own brandId. We
  // aggregate per-brand `listForBrand` calls rather than adding a new IPC.
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);

  useEffect(() => {
    void refresh();
    void refreshSettings();
  }, [refresh, refreshSettings]);

  // Load templates for EVERY visible brand and flatten into one list. The
  // brand key (joined ids) keeps this from re-firing on unrelated renders.
  const brandKey = visibleBrands.map((b) => b.id).join(',');
  useEffect(() => {
    if (visibleBrands.length === 0) {
      setTemplates([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.all(
      visibleBrands.map((b) => window.api.template.listForBrand(b.id)),
    ).then((lists) => {
      if (cancelled) return;
      setTemplates(lists.flat());
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // brandKey (joined ids) is the stable signal — depending on the
    // visibleBrands array identity would re-fire on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandKey]);

  // The brand a NEW template should belong to: the active filter when one
  // is set, otherwise the user's default brand. When "All brands" is the
  // filter, new templates land in the default brand (surfaced in the UI).
  const newTemplateBrandId = filterBrandId ?? defaultBrandId;

  // Auto-open new-template flow if redirected here from the brand wizard.
  useEffect(() => {
    const wantNew = params.get('new') === '1';
    if (wantNew && newTemplateBrandId) {
      navigate(`/designer/${newTemplateBrandId}/new`, { replace: true });
    }
  }, [params, newTemplateBrandId, navigate]);

  // Filtered + sorted view: brand filter first, then group by brand so the
  // list reads brand-by-brand even in "All brands" mode (a template's brand
  // is obvious from both the grouping and the per-card chip).
  const visibleTemplates = filterBrandId
    ? templates.filter((tpl) => tpl.brandId === filterBrandId)
    : templates;

  const commitRename = async () => {
    if (!renaming) return;
    const target = templates.find((t) => t.id === renaming.id);
    const trimmed = renaming.value.trim();
    setRenaming(null);
    if (!target || !trimmed || trimmed === target.name) return;
    try {
      const saved = await window.api.template.save({ ...target, name: trimmed });
      setTemplates((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    } catch (err) {
      toast.error(t('templates.errors.rename', { error: String(err) }));
    }
  };

  // Operations use the template's OWN brandId (not a global selection) so
  // they work correctly in "All brands" mode where the list spans brands.
  const handleDuplicate = async (template: Template) => {
    try {
      const copy = await window.api.template.duplicate(
        template.brandId,
        template.id,
      );
      if (copy) setTemplates((prev) => [...prev, copy]);
    } catch (err) {
      toast.error(t('templates.errors.duplicate', { error: String(err) }));
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const ok = await window.api.template.delete(
        confirmDelete.brandId,
        confirmDelete.id,
      );
      if (ok) setTemplates((prev) => prev.filter((t) => t.id !== confirmDelete.id));
    } catch (err) {
      toast.error(t('templates.errors.delete', { error: String(err) }));
    }
    setConfirmDelete(null);
  };

  if (brands.length === 0) {
    return (
      <Page title={t('templates.title')}>
        {brandsLoading ? (
          <TemplateCardSkeletonGrid />
        ) : (
          <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
            <h3 className="text-sm font-semibold text-fg-base">
              {t('templates.noBrands.title')}
            </h3>
            <p className="mt-1 text-xs text-fg-muted">
              {t('templates.noBrands.description')}
            </p>
          </div>
        )}
      </Page>
    );
  }

  return (
    <>
      <Page
        title={t('templates.title')}
        actions={
          <Button
            variant="primary"
            onClick={() =>
              newTemplateBrandId &&
              navigate(`/designer/${newTemplateBrandId}/new`)
            }
            disabled={!newTemplateBrandId}
            title={
              filterBrandId
                ? `New template for ${visibleBrands.find((b) => b.id === filterBrandId)?.name ?? 'this brand'}`
                : `New template for ${visibleBrands.find((b) => b.id === newTemplateBrandId)?.name ?? 'your default brand'}`
            }
          >
            <IconPlus size={14} /> {t('templates.newTemplate')}
          </Button>
        }
      >
        {(() => {
          // Per-brand template counts for the filter chips, so users see
          // "how many, and which brand" at a glance.
          const counts = new Map<string, number>();
          for (const tpl of templates) {
            counts.set(tpl.brandId, (counts.get(tpl.brandId) ?? 0) + 1);
          }
          const newBrand = visibleBrands.find((b) => b.id === newTemplateBrandId);
          return (
            <div className="mb-4 space-y-2 rounded-md border border-border-base bg-bg-surface px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {/* All brands pill — the default. Active when no brand
                    filter is set. */}
                <BrandFilterPill
                  active={!filterBrandId}
                  onClick={() => setFilterBrandId(null)}
                  count={templates.length}
                >
                  All brands
                </BrandFilterPill>
                {visibleBrands.map((b) => (
                  <BrandFilterPill
                    key={b.id}
                    active={filterBrandId === b.id}
                    onClick={() => setFilterBrandId(b.id)}
                    color={b.color}
                    count={counts.get(b.id) ?? 0}
                  >
                    {b.name}
                  </BrandFilterPill>
                ))}
              </div>
              <div className="text-[10px] text-fg-subtle">
                Showing{' '}
                <strong className="text-fg-muted">
                  {visibleTemplates.length} template
                  {visibleTemplates.length === 1 ? '' : 's'}
                </strong>
                {filterBrandId
                  ? ''
                  : ` across ${counts.size} brand${counts.size === 1 ? '' : 's'}`}
                . New templates you create belong to{' '}
                <strong className="text-fg-muted">
                  {newBrand?.name ?? '—'}
                </strong>
                {filterBrandId ? '' : ' (your default brand)'}.
              </div>
            </div>
          );
        })()}

        {loading ? (
          <TemplateCardSkeletonGrid />
        ) : visibleTemplates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
            <h3 className="text-sm font-semibold text-fg-base">
              {t('templates.empty.title')}
            </h3>
            <p className="mt-1 text-xs text-fg-muted">
              {t('templates.empty.description')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                brand={visibleBrands.find((b) => b.id === tpl.brandId) ?? null}
                renaming={renaming?.id === tpl.id ? renaming.value : null}
                onOpen={() =>
                  navigate(`/designer/${tpl.brandId}/${tpl.id}`)
                }
                onStartRename={() => setRenaming({ id: tpl.id, value: tpl.name })}
                onChangeRename={(value) => setRenaming({ id: tpl.id, value })}
                onCommitRename={commitRename}
                onCancelRename={() => setRenaming(null)}
                onDuplicate={() => handleDuplicate(tpl)}
                onDelete={() => setConfirmDelete(tpl)}
              />
            ))}
          </div>
        )}
      </Page>

      <ConfirmDialog
        open={!!confirmDelete}
        title={t('templates.delete.title', {
          name: confirmDelete?.name ?? t('templates.delete.fallbackName'),
        })}
        message={
          <>
            {t('templates.delete.messageLine1Pre')}
            <strong>{t('templates.delete.messageLine1Strong')}</strong>
            {t('templates.delete.messageLine1Post')}
            <br />
            <br />
            {t('templates.delete.messageLine2')}
          </>
        }
        confirmLabel={t('templates.delete.confirmLabel')}
        cancelLabel={t('templates.delete.cancelLabel')}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

// Brand filter pill used in the Templates header. Shows the brand's
// color dot + name + a count badge. "All brands" passes no color.
function BrandFilterPill({
  active,
  onClick,
  color,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-accent bg-accent/10 text-fg-base'
          : 'border-border-base text-fg-muted hover:bg-bg-hover hover:text-fg-base',
      ].join(' ')}
    >
      {color && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full border border-border-base"
          style={{ background: color }}
          aria-hidden
        />
      )}
      <span className="truncate">{children}</span>
      <span
        className={[
          'rounded px-1 text-[10px]',
          active ? 'bg-accent/20 text-fg-base' : 'bg-bg-elevated text-fg-subtle',
        ].join(' ')}
      >
        {count}
      </span>
    </button>
  );
}

function TemplateCard({
  template,
  brand,
  renaming,
  onOpen,
  onStartRename,
  onChangeRename,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onDelete,
}: {
  template: Template;
  brand: { id: string; name: string; color: string } | null;
  renaming: string | null;
  onOpen: () => void;
  onStartRename: () => void;
  onChangeRename: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const isRenaming = renaming !== null;

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  return (
    <div
      className="group relative rounded-lg border border-border-base bg-bg-surface p-4 transition-colors hover:bg-bg-hover"
      onClick={() => {
        if (!isRenaming) onOpen();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (isRenaming) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renaming ?? ''}
              onChange={(e) => onChangeRename(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCommitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelRename();
                }
              }}
              onBlur={onCommitRename}
              className="w-full rounded border border-border-base bg-bg-elevated px-2 py-1 text-sm font-semibold text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          ) : (
            <div className="truncate text-sm font-semibold text-fg-base">
              {template.name}
            </div>
          )}
          <div className="mt-1 text-xs text-fg-muted">
            {template.width_mm}×{template.height_mm} mm · {template.orientation}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-fg-subtle">
            {/* Brand chip — so each card shows which brand it belongs to
                at a glance, essential in the "All brands" view. */}
            {brand && (
              <span className="inline-flex items-center gap-1 rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-fg-muted">
                <span
                  className="h-2 w-2 shrink-0 rounded-full border border-border-base"
                  style={{ background: brand.color }}
                  aria-hidden
                />
                {brand.name}
              </span>
            )}
            <span>
              {t('templates.card.elementCount', {
                count: template.elements.length,
              })}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartRename();
            }}
            title={t('templates.card.renameTitle')}
            className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
          >
            <IconPencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title={t('templates.card.duplicateTitle')}
            className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
          >
            <IconCopy size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={t('templates.card.deleteTitle')}
            className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-danger"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
