import { useEffect, useRef, useState } from 'react';
import {
  IconX,
  IconTrash,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';
import { Button } from '../../components/Button';
import { Field, TextInput, TextArea } from '../../components/FormField';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { toast } from '../../components/Toast';
import { useBrandStore } from '../../stores/brandStore';
import { useProductStore } from '../../stores/productStore';
import { useCompanyStore } from '../../stores/companyStore';
import { useAssetsDir, productImageUrl } from '../../hooks/useAssetsDir';
import {
  MAX_IMAGES_PER_PRODUCT,
  type Product,
  type ProductInput,
  type ProductStatus,
} from '../../../shared/types/product';
import { DEFAULT_PRICE_GROUPS } from '../../../shared/types/company';

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
  const activeCompany = useCompanyStore(
    (s) => s.companies.find((c) => c.id === s.activeCompanyId) ?? null,
  );
  // Resolve price groups: active company's list when configured, otherwise
  // the seeded default. Empty array is a legit "this company has no price
  // tiers" state — the Prices section just won't render.
  const priceGroups =
    activeCompany?.priceGroups && activeCompany.priceGroups.length >= 0
      ? activeCompany.priceGroups
      : [...DEFAULT_PRICE_GROUPS];

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
  const assetsDir = useAssetsDir();

  // The form binds to the product passed in, but images can change behind
  // its back (Add / Paste / Reorder / Remove all call IPC that returns the
  // updated product). Mirror the canonical list locally so the UI reflects
  // the latest state without a parent re-render.
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  useEffect(() => {
    setImages(product?.images ?? []);
  }, [product]);

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

  // ── Image management handlers ─────────────────────────────────────────────
  // All four operations end up calling ProductService and getting back the
  // updated product; we mirror its images into local state so the grid
  // re-renders immediately and the parent store also picks up via the
  // updateProduct fast-path used by addImage.

  // Helper: most IPC handlers return Promise<Product | null>. Map that into
  // a local images update + push to the store so the table row reflects too.
  const applyUpdated = (updated: Product | null) => {
    if (!updated) return;
    setImages(updated.images);
    // Keep the products-table list fresh without a full refresh — the store's
    // updateProduct fast-path already handles this via the IPC the caller
    // used, but only for the products array; do a soft set here as well so
    // the parent table row reflects new thumbnails without a list reload.
    void useProductStore.setState((s) => ({
      products: s.products.map((p) => (p.id === updated.id ? updated : p)),
    }));
  };

  const onAddImage = async () => {
    if (!product) {
      toast.info('Save the product first, then add images.');
      return;
    }
    if (images.length >= MAX_IMAGES_PER_PRODUCT) {
      toast.error(
        `This product already has the maximum of ${MAX_IMAGES_PER_PRODUCT} images.`,
      );
      return;
    }
    const path = await window.api.products.pickImageFile();
    if (!path) return; // user cancelled
    try {
      const updated = await window.api.products.importImage(product.id, path);
      applyUpdated(updated);
    } catch (err) {
      toast.error(`Couldn't import image: ${String(err)}`);
    }
  };

  const onPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!product) return; // silent — user needs to save first; paste is keyboard, hard to surface a hint
    const item = Array.from(e.clipboardData?.items ?? []).find((it) =>
      it.type.startsWith('image/'),
    );
    if (!item) return; // not an image — let default paste happen (e.g. into the description box)
    e.preventDefault();
    if (images.length >= MAX_IMAGES_PER_PRODUCT) {
      toast.error(
        `This product already has the maximum of ${MAX_IMAGES_PER_PRODUCT} images.`,
      );
      return;
    }
    const blob = item.getAsFile();
    if (!blob) return;
    try {
      const buf = await blob.arrayBuffer();
      const subtype = (blob.type.split('/')[1] ?? 'png').toLowerCase();
      const ext = subtype === 'jpeg' ? '.jpg' : `.${subtype}`;
      const updated = await window.api.products.importImageFromBytes(
        product.id,
        buf,
        ext,
      );
      applyUpdated(updated);
      toast.success('Image pasted.');
    } catch (err) {
      toast.error(`Couldn't paste image: ${String(err)}`);
    }
  };

  const onRemoveImage = async (relPath: string) => {
    if (!product) return;
    const updated = await window.api.products.removeImage(product.id, relPath);
    applyUpdated(updated);
  };

  const onSetMain = async (relPath: string) => {
    if (!product) return;
    const updated = await window.api.products.setMainImage(product.id, relPath);
    applyUpdated(updated);
  };

  const onMoveImage = async (relPath: string, dir: -1 | 1) => {
    if (!product) return;
    const idx = images.indexOf(relPath);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    const updated = await window.api.products.reorderImages(product.id, next);
    applyUpdated(updated);
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

          {/* Scrollable body. onPaste lives here so ⌘V anywhere inside the
              modal funnels images through the importer; non-image paste
              (e.g. into the description) keeps its default behavior. */}
          <div
            className="scrollbar-thin max-h-[70vh] overflow-y-auto px-5 py-4"
            onPaste={(e) => void onPaste(e)}
          >
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

            {/* Prices — pulled from active company.priceGroups so users can
                customize their tiers per company (Retail, Wholesale, VIP, …).
                Hidden entirely when the company has zero price groups. */}
            {priceGroups.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-fg-subtle">
                Prices
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {priceGroups.map((group) => (
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
            )}

            {/* Images section */}
            <div className="mt-6">
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-xs font-semibold uppercase tracking-widest text-fg-subtle">
                  Images {images.length} / {MAX_IMAGES_PER_PRODUCT}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void onAddImage()}
                  disabled={
                    !product || images.length >= MAX_IMAGES_PER_PRODUCT
                  }
                  title={
                    !product
                      ? 'Save the product first, then add images.'
                      : images.length >= MAX_IMAGES_PER_PRODUCT
                        ? `Maximum ${MAX_IMAGES_PER_PRODUCT} images per product`
                        : 'Pick an image file to add'
                  }
                >
                  <IconPlus size={12} /> Add image
                </Button>
              </div>

              {!product ? (
                <div className="rounded-md border border-dashed border-border-base bg-bg-elevated/40 px-3 py-4 text-center text-xs text-fg-subtle">
                  Save the product first, then come back here to add images.
                </div>
              ) : images.length === 0 ? (
                <div className="rounded-md border border-dashed border-border-base bg-bg-elevated/40 px-3 py-4 text-center text-xs text-fg-subtle">
                  No images yet. Click <strong>Add image</strong>, or paste
                  one with <kbd className="rounded bg-bg-elevated px-1">⌘V</kbd>.
                  Same file imported twice is detected and skipped.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {images.map((relPath, idx) => (
                    <ImageTile
                      key={relPath}
                      relPath={relPath}
                      assetsDir={assetsDir}
                      isMain={idx === 0}
                      canMoveLeft={idx > 0}
                      canMoveRight={idx < images.length - 1}
                      onSetMain={() => void onSetMain(relPath)}
                      onMoveLeft={() => void onMoveImage(relPath, -1)}
                      onMoveRight={() => void onMoveImage(relPath, 1)}
                      onRemove={() => void onRemoveImage(relPath)}
                    />
                  ))}
                </div>
              )}

              {product && (
                <div className="mt-2 text-[10px] text-fg-subtle">
                  Tip: paste an image directly with <kbd>⌘V</kbd>. The same
                  file is recognised by content and won't duplicate on disk.
                </div>
              )}
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

// ── Image tile ──────────────────────────────────────────────────────────────

function ImageTile({
  relPath,
  assetsDir,
  isMain,
  canMoveLeft,
  canMoveRight,
  onSetMain,
  onMoveLeft,
  onMoveRight,
  onRemove,
}: {
  relPath: string;
  assetsDir: string | null;
  isMain: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onSetMain: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
}) {
  const url = productImageUrl(assetsDir, relPath);
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-border-base bg-bg-elevated">
      {url ? (
        <img
          src={url}
          alt={relPath}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-fg-subtle">
          loading…
        </div>
      )}

      {/* Main badge / set-as-main toggle */}
      {isMain ? (
        <span
          title="Main image (position 0)"
          className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-success px-1.5 py-0.5 text-[9px] font-semibold text-white"
        >
          <IconStarFilled size={9} /> Main
        </span>
      ) : (
        <button
          onClick={onSetMain}
          title="Set as main image"
          className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          <IconStar size={9} /> Set main
        </button>
      )}

      {/* Remove (top-right) */}
      <button
        onClick={onRemove}
        aria-label="Remove image"
        title="Remove image"
        className="absolute right-1 top-1 rounded bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger"
      >
        <IconX size={11} />
      </button>

      {/* Reorder controls (bottom row) */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-1 py-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onMoveLeft}
          disabled={!canMoveLeft}
          aria-label="Move left"
          className="rounded p-0.5 text-white disabled:opacity-30 hover:bg-white/20"
        >
          <IconChevronLeft size={11} />
        </button>
        <button
          onClick={onMoveRight}
          disabled={!canMoveRight}
          aria-label="Move right"
          className="rounded p-0.5 text-white disabled:opacity-30 hover:bg-white/20"
        >
          <IconChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}
