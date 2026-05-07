import { useEffect, useState } from 'react';
import { IconX, IconPencil } from '@tabler/icons-react';
import { useBrandStore } from '../../stores/brandStore';
import { ManualEntry } from './ManualEntry';

type SkuRow = Awaited<ReturnType<typeof window.api.import.listSkus>>[number];

export function SkuLookup() {
  const { brands } = useBrandStore();
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? '');
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SkuRow | null>(null);

  const reload = async () => {
    if (!brandId) return;
    const list = await window.api.import.listSkus(brandId);
    setSkus(list);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const filtered = skus.filter(
    (s) =>
      s.sku.toLowerCase().includes(query.toLowerCase()) ||
      (s.product_name ?? '').toLowerCase().includes(query.toLowerCase()),
  );

  const onDelete = async (sku: string) => {
    if (!brandId) return;
    if (
      !window.confirm(
        `Delete SKU "${sku}"? Generated label files on disk are not affected.`,
      )
    ) {
      return;
    }
    await window.api.sku.delete(brandId, sku);
    await reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search SKU or name…"
          className="flex-1 max-w-md rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        />
        <span className="text-xs text-fg-muted">
          {filtered.length} of {skus.length}
        </span>
      </div>

      {skus.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
          No SKUs for this brand yet. Import a CSV or add one on the Manual entry tab.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-base">
          <table className="w-full text-xs">
            <thead className="bg-bg-elevated text-fg-muted">
              <tr>
                <th className="px-2 py-1.5 text-left">SKU</th>
                <th className="px-2 py-1.5 text-left">Product</th>
                <th className="px-2 py-1.5 text-left">Barcode</th>
                <th className="px-2 py-1.5 text-left">Variant</th>
                <th className="px-2 py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((s) => (
                <tr
                  key={s.sku}
                  onClick={() => setEditing(s)}
                  title="Click to edit"
                  className="cursor-pointer hover:bg-bg-hover"
                >
                  <td className="border-b border-border-subtle px-2 py-1.5 font-mono">
                    {s.sku}
                  </td>
                  <td className="border-b border-border-subtle px-2 py-1.5">
                    {s.product_name ?? '—'}
                  </td>
                  <td className="border-b border-border-subtle px-2 py-1.5">
                    {s.barcode ?? '—'}
                  </td>
                  <td className="border-b border-border-subtle px-2 py-1.5">
                    {s.variant ?? '—'}
                  </td>
                  <td className="border-b border-border-subtle px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(s);
                        }}
                        title="Edit this SKU"
                        className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
                      >
                        <IconPencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDelete(s.sku);
                        }}
                        title="Delete this SKU"
                        className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-danger"
                      >
                        <IconX size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div className="bg-bg-elevated px-2 py-1 text-[10px] text-fg-subtle">
              Showing first 200 results.
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditSkuDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await reload();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditSkuDialog({
  row,
  onClose,
  onSaved,
}: {
  row: SkuRow;
  onClose: () => void;
  onSaved: (saved: SkuRow) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-sku-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border-base bg-bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <h3 id="edit-sku-title" className="text-sm font-semibold text-fg-base">
            Edit SKU <span className="font-mono">{row.sku}</span>
          </h3>
          <button
            onClick={onClose}
            title="Close"
            className="rounded p-1 text-fg-muted hover:bg-bg-elevated hover:text-fg-base"
          >
            <IconX size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <ManualEntry
            initialValues={row}
            lockedBrandId={row.brand_id}
            onSaved={onSaved}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
