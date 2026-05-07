import { useEffect, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { useBrandStore } from '../../stores/brandStore';

export function SkuLookup() {
  const { brands } = useBrandStore();
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? '');
  const [skus, setSkus] = useState<
    Awaited<ReturnType<typeof window.api.import.listSkus>>
  >([]);
  const [query, setQuery] = useState('');

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
                <tr key={s.sku} className="hover:bg-bg-hover">
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
                    <button
                      onClick={() => void onDelete(s.sku)}
                      title="Delete this SKU"
                      className="rounded p-1.5 text-fg-muted hover:bg-bg-elevated hover:text-danger"
                    >
                      <IconX size={12} />
                    </button>
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
    </div>
  );
}
