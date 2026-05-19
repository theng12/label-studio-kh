import { useEffect, useRef, useState } from 'react';
import { IconX, IconTrash } from '@tabler/icons-react';
import { Button } from '../../components/Button';
import { Field, TextInput, TextArea } from '../../components/FormField';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useBrandStore } from '../../stores/brandStore';
import { useProductStore } from '../../stores/productStore';
import {
  DEFAULT_PRICE_GROUPS,
  type Product,
  type ProductInput,
  type ProductStatus,
} from '../../../shared/types/product';

// Mirrors spec §17 — the add/edit modal. Phase 2 covers all scalar fields
// (SKU + identifiers + classification + status + tags + description + prices).
// Phase 3 will add the images section under this same form.

interface Props {
  /** null = create new, otherwise editing this product */
  product: Product | null;
  /** The brand selected in the parent sidebar — pre-fills the dropdown when
   *  creating, and is the default landing if no other context is set. */
  defaultBrandId: string;
  onClose: () => void;
}

// Reusable empty form state so we can reset cleanly between sessions.
function makeEmptyForm(brandId: string): ProductInput & { tagsRaw: string } {
  return {
    brandId,
    sku: '',
    barcode: null,
    secondaryCode: null,
    name: null,
    category: null,
    subcategory: null,
    colorFinish: null,
    description: null,
    unit: null,
    prices: {},
    tags: [],
    status: 'active',
    // tagsRaw is the comma-separated editing buffer; we split on save.
    tagsRaw: '',
  };
}

export function ProductForm({ product, defaultBrandId, onClose }: Props) {
  const { brands } = useBrandStore();
  const createProduct = useProductStore((s) => s.createProduct);
  const updateProduct = useProductStore((s) => s.updateProduct);
  const removeProduct = useProductStore((s) => s.removeProduct);

  const [form, setForm] = useState(() => {
    if (product) {
      return {
        brandId: product.brandId,
        sku: product.sku,
        barcode: product.barcode,
        secondaryCode: product.secondaryCode,
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
        colorFinish: product.colorFinish,
        description: product.description,
        unit: product.unit,
        prices: { ...product.prices },
        tags: product.tags,
        status: product.status,
        tagsRaw: product.tags.join(', '),
      };
    }
    return makeEmptyForm(defaultBrandId);
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const skuRef = useRef<HTMLInputElement>(null);

  // Esc to close (matches every other modal in the app).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDelete) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    skuRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmDelete]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updatePrice = (group: string, raw: string) => {
    setForm((f) => {
      const next = { ...f.prices };
      const trimmed = raw.trim();
      if (trimmed === '') {
        delete next[group];
      } else {
        // Keep as number when parseable, otherwise keep the raw string —
        // some users may want "TBD" or a non-numeric label.
        const num = Number(trimmed);
        next[group] = Number.isFinite(num) ? num : trimmed;
      }
      return { ...f, prices: next };
    });
  };

  const onSave = async () => {
    setError(null);
    const sku = form.sku.trim();
    if (!sku) {
      setError('SKU is required.');
      skuRef.current?.focus();
      return;
    }
    if (!form.brandId) {
      setError('Brand is required.');
      return;
    }

    const tags = form.tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: ProductInput = {
      brandId: form.brandId,
      sku,
      barcode: form.barcode || null,
      secondaryCode: form.secondaryCode || null,
      name: form.name || null,
      category: form.category || null,
      subcategory: form.subcategory || null,
      colorFinish: form.colorFinish || null,
      description: form.description || null,
      unit: form.unit || null,
      prices: form.prices,
      tags,
      status: form.status,
    };

    setSaving(true);
    try {
      if (product) {
        await updateProduct(product.id, payload);
      } else {
        await createProduct(payload);
      }
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!product) return;
    setConfirmDelete(false);
    const ok = await removeProduct(product.id);
    if (ok) onClose();
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !confirmDelete) onClose();
        }}
      >
        <div className="w-full max-w-3xl rounded-lg border border-border-base bg-bg-surface shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
            <h3
              id="product-form-title"
              className="text-sm font-semibold text-fg-base"
            >
              {product ? `Edit ${product.sku}` : 'New product'}
            </h3>
            <button
              onClick={onClose}
              aria-label="Close (Esc)"
              title="Close (Esc)"
              className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-base"
            >
              <IconX size={16} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="scrollbar-thin max-h-[70vh] overflow-y-auto px-5 py-4">
            {error && (
              <div className="mb-3 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
                {error}
              </div>
            )}

            {/* Identity row */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="SKU *" hint="Required. Unique per brand. Trim whitespace; case-sensitive.">
                {/* Plain input so we can attach a ref for focus on open;
                    TextInput doesn't forward refs. */}
                <input
                  ref={skuRef}
                  value={form.sku}
                  onChange={(e) => update('sku', e.target.value)}
                  placeholder="e.g. SHELF-001"
                  autoComplete="off"
                  className="w-full rounded-md border border-border-base bg-bg-surface px-3 py-2 text-sm text-fg-base placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </Field>
              <Field label="Brand">
                <select
                  value={form.brandId}
                  onChange={(e) => update('brandId', e.target.value)}
                  className="w-full rounded-md border border-border-base bg-bg-surface px-3 py-2 text-sm text-fg-base"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Barcode" hint="Optional. EAN, UPC, or other.">
                <TextInput
                  value={form.barcode ?? ''}
                  onChange={(e) => update('barcode', e.target.value || null)}
                />
              </Field>
              <Field label="Secondary code" hint="Optional. Supplier code or alt SKU.">
                <TextInput
                  value={form.secondaryCode ?? ''}
                  onChange={(e) =>
                    update('secondaryCode', e.target.value || null)
                  }
                />
              </Field>
            </div>

            {/* Classification */}
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Name">
                <TextInput
                  value={form.name ?? ''}
                  onChange={(e) => update('name', e.target.value || null)}
                />
              </Field>
              <Field label="Category">
                <TextInput
                  value={form.category ?? ''}
                  onChange={(e) => update('category', e.target.value || null)}
                />
              </Field>
              <Field label="Subcategory">
                <TextInput
                  value={form.subcategory ?? ''}
                  onChange={(e) => update('subcategory', e.target.value || null)}
                />
              </Field>
              <Field label="Color / Finish">
                <TextInput
                  value={form.colorFinish ?? ''}
                  onChange={(e) => update('colorFinish', e.target.value || null)}
                />
              </Field>
              <Field label="Unit" hint="e.g. sqm, piece, box">
                <TextInput
                  value={form.unit ?? ''}
                  onChange={(e) => update('unit', e.target.value || null)}
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) =>
                    update('status', e.target.value as ProductStatus)
                  }
                  className="w-full rounded-md border border-border-base bg-bg-surface px-3 py-2 text-sm text-fg-base"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="draft">Draft</option>
                </select>
              </Field>
            </div>

            <div className="mt-3">
              <Field
                label="Tags (comma-separated)"
                hint="Free-form labels, used by search."
              >
                <TextInput
                  value={form.tagsRaw}
                  onChange={(e) => update('tagsRaw', e.target.value)}
                  placeholder="e.g. promo, summer, clearance"
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Description">
                <TextArea
                  value={form.description ?? ''}
                  onChange={(e) => update('description', e.target.value || null)}
                  rows={3}
                />
              </Field>
            </div>

            {/* Prices */}
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-fg-subtle">
                Prices
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {DEFAULT_PRICE_GROUPS.map((group) => (
                  <Field key={group} label={group}>
                    <TextInput
                      value={
                        // form.prices is always defined (initialized to {} in
                        // makeEmptyForm + copied on edit). Narrowing the
                        // `prices?: ProductPrices` field from ProductInput.
                        (form.prices ?? {})[group] === undefined
                          ? ''
                          : String((form.prices ?? {})[group])
                      }
                      onChange={(e) => updatePrice(group, e.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                    />
                  </Field>
                ))}
              </div>
            </div>

            {/* Images placeholder — Phase 3 wires this up properly. */}
            <div className="mt-6 rounded-md border border-dashed border-border-base bg-bg-elevated/40 px-3 py-4 text-center text-xs text-fg-subtle">
              Images and clipboard-paste support land in the next update.
              <br />
              For now, the existing single-image flow on the import side
              still works.
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border-subtle px-5 py-3">
            <div>
              {product && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  title="Delete this product"
                >
                  <IconTrash size={14} /> Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void onSave()}
                disabled={saving || !form.sku.trim()}
              >
                {saving ? 'Saving…' : product ? 'Save changes' : 'Create product'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {product && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete ${product.sku}?`}
          message={
            <>
              Removes this product permanently. Generated labels on disk are
              unaffected, but they'll no longer link back to a product in
              this app.
              <br />
              <br />
              This cannot be undone.
            </>
          }
          confirmLabel="Delete product"
          cancelLabel="Keep it"
          tone="danger"
          onConfirm={() => void onDelete()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
