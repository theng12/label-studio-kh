import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  IconPlus,
  IconPencil,
  IconCopy,
  IconTrash,
} from '@tabler/icons-react';
import { Page } from '../components/Page';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useBrandStore } from '../stores/brandStore';
import { toast } from '../components/Toast';
import type { Template } from '../../shared/types/template';

export default function Templates() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { brands, refresh } = useBrandStore();
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(
    params.get('brand'),
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedBrandId && brands.length > 0) {
      setSelectedBrandId(brands[0]!.id);
    }
  }, [brands, selectedBrandId]);

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
      toast.error(`Couldn't rename template: ${String(err)}`);
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
      toast.error(`Couldn't duplicate template: ${String(err)}`);
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
      toast.error(`Couldn't delete template: ${String(err)}`);
    }
    setConfirmDelete(null);
  };

  if (brands.length === 0) {
    return (
      <Page title="Templates">
        <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
          <h3 className="text-sm font-semibold text-fg-base">Create a brand first</h3>
          <p className="mt-1 text-xs text-fg-muted">
            Templates belong to brands. Create a brand on the Brands page to get started.
          </p>
        </div>
      </Page>
    );
  }

  return (
    <>
      <Page
        title="Templates"
        actions={
          <Button
            variant="primary"
            onClick={() =>
              selectedBrandId && navigate(`/designer/${selectedBrandId}/new`)
            }
          >
            <IconPlus size={14} /> New template
          </Button>
        }
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-fg-muted">Brand</span>
          <select
            value={selectedBrandId ?? ''}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm text-fg-base"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-sm text-fg-muted">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-base p-12 text-center">
            <h3 className="text-sm font-semibold text-fg-base">No templates yet</h3>
            <p className="mt-1 text-xs text-fg-muted">
              Click "New template" to start designing.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                renaming={renaming?.id === t.id ? renaming.value : null}
                onOpen={() =>
                  selectedBrandId &&
                  navigate(`/designer/${selectedBrandId}/${t.id}`)
                }
                onStartRename={() => setRenaming({ id: t.id, value: t.name })}
                onChangeRename={(value) => setRenaming({ id: t.id, value })}
                onCommitRename={commitRename}
                onCancelRename={() => setRenaming(null)}
                onDuplicate={() => handleDuplicate(t)}
                onDelete={() => setConfirmDelete(t)}
              />
            ))}
          </div>
        )}
      </Page>

      <ConfirmDialog
        open={!!confirmDelete}
        title={`Delete ${confirmDelete?.name ?? 'template'}?`}
        message={
          <>
            This removes the template from this brand.{' '}
            <strong>
              Label files generated from it on disk are not affected
            </strong>{' '}
            — they stay where they are.
            <br />
            <br />
            This cannot be undone.
          </>
        }
        confirmLabel="Delete template"
        cancelLabel="Keep it"
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
            {template.elements.length} element
            {template.elements.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartRename();
            }}
            title="Rename template"
            className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
          >
            <IconPencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title="Duplicate template"
            className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
          >
            <IconCopy size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete template"
            className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-danger"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
