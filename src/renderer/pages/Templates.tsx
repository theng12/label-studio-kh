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
  const [selectedBrandId, setSelectedBrandIdState] = useState<string | null>(
    params.get('brand'),
  );
  const setSelectedBrandId = (id: string | null) => {
    setSelectedBrandIdState(id);
    if (id) pickBrand(id);
  };
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

  useEffect(() => {
    if (!selectedBrandId && defaultBrandId) {
      // Don't push to lastUsed here — this is the auto-default, not a user pick.
      setSelectedBrandIdState(defaultBrandId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBrandId]);

  useEffect(() => {
    if (!selectedBrandId) return;
    setLoading(true);
    window.api.template.listForBrand(selectedBrandId).then((list) => {
      setTemplates(list);
      setLoading(false);
    });
  }, [selectedBrandId]);

  // Auto-open new-template flow if redirected here from the brand wizard
  useEffect(() => {
    const wantNew = params.get('new') === '1';
    if (wantNew && selectedBrandId) {
      navigate(`/designer/${selectedBrandId}/new`, { replace: true });
    }
  }, [params, selectedBrandId, navigate]);

  const commitRename = async () => {
    if (!renaming || !selectedBrandId) return;
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

  const handleDuplicate = async (template: Template) => {
    if (!selectedBrandId) return;
    try {
      const copy = await window.api.template.duplicate(
        selectedBrandId,
        template.id,
      );
      if (copy) setTemplates((prev) => [...prev, copy]);
    } catch (err) {
      toast.error(t('templates.errors.duplicate', { error: String(err) }));
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete || !selectedBrandId) return;
    try {
      const ok = await window.api.template.delete(
        selectedBrandId,
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
              selectedBrandId && navigate(`/designer/${selectedBrandId}/new`)
            }
          >
            <IconPlus size={14} /> {t('templates.newTemplate')}
          </Button>
        }
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-fg-muted">{t('templates.brandLabel')}</span>
          <select
            value={selectedBrandId ?? ''}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm text-fg-base"
          >
            {visibleBrands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <TemplateCardSkeletonGrid />
        ) : templates.length === 0 ? (
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
            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                renaming={renaming?.id === tpl.id ? renaming.value : null}
                onOpen={() =>
                  selectedBrandId &&
                  navigate(`/designer/${selectedBrandId}/${tpl.id}`)
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

function TemplateCard({
  template,
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
          <div className="mt-2 text-xs text-fg-subtle">
            {t('templates.card.elementCount', { count: template.elements.length })}
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
