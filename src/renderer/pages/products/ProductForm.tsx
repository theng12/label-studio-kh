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
  /** The product currently being edited. null when in empty / creating mode. */
  product: Product | null;
  /** When true, the panel renders the blank-new-product form (Create button
   *  instead of Save changes). When false AND product is null, the panel
   *  shows the "No product selected" empty placeholder. */
  isCreating?: boolean;
  /** The brand selected in the parent sidebar — pre-fills the dropdown when
   *  creating, and is the default landing if no other context is set. */
  defaultBrandId: string;
  /** Called when the user clicks Cancel or hits the X. Parent should clear
   *  its selection so the panel falls back to the empty placeholder — the
   *  panel itself stays mounted (no unmount, no animation). */
  onClose: () => void;
  /** Called when the user clicks "+ New product" from the empty placeholder.
   *  Parent flips its state into isCreating=true. */
  onStartCreate?: () => void;
}

type FormState = ProductInput & { tagsRaw: string };

// Reusable empty form state so we can reset cleanly between sessions.
function makeEmptyForm(brandId: string): FormState {
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
    customFields: {},
    tags: [],
    status: 'active',
    // v7 inventory/lifecycle — all optional, default to "unset"
    expiryDate: null,
    taxRate: null,
    reorderPoint: null,
    reorderQuantity: null,
    trackInventory: false,
    variantAttributes: null,
    // tagsRaw is the comma-separated editing buffer; we split on save.
    tagsRaw: '',
  };
}

// Map a saved product into editable form state. Used by BOTH the initial
// useState seed AND the re-sync effect — critical now that the panel is
// always-mounted (it no longer remounts per selection like the old modal,
// so without the effect the form would show the first-selected product's
// data forever while the header showed a different SKU).
function productToForm(product: Product): FormState {
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
    customFields: { ...product.customFields },
    tags: product.tags,
    status: product.status,
    expiryDate: product.expiryDate,
    taxRate: product.taxRate,
    reorderPoint: product.reorderPoint,
    reorderQuantity: product.reorderQuantity,
    trackInventory: product.trackInventory,
    variantAttributes: product.variantAttributes,
    tagsRaw: product.tags.join(', '),
  };
}

export function ProductForm({
  product,
  isCreating = false,
  defaultBrandId,
  onClose,
  onStartCreate,
}: Props) {
  // Three render modes:
  //   - product truthy             → edit-existing form
  //   - isCreating === true        → blank new-product form
  //   - neither                    → "No product selected" placeholder
  const isEmpty = !product && !isCreating;
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

  // Company-defined custom fields. Names come from /company → Custom
  // product fields; ProductForm renders one input per name and reads /
  // writes its value into `product.customFields[name]`. If the company
  // hasn't defined any, the section hides entirely.
  const customFieldDefs = activeCompany?.customFields ?? [];

  const [form, setForm] = useState<FormState>(() =>
    product ? productToForm(product) : makeEmptyForm(defaultBrandId),
  );

  // Re-sync the form whenever the selected product changes (or we switch
  // into create mode). The panel is always-mounted now, so the useState
  // seed above only runs once — without this effect, selecting a different
  // product would update the header ("Edit theng5") but leave the form
  // fields showing the previously-selected product. Keyed on product.id
  // (not the object identity) so a no-op parent re-render doesn't clobber
  // in-progress edits.
  useEffect(() => {
    if (product) {
      setForm(productToForm(product));
    } else if (isCreating) {
      setForm(makeEmptyForm(defaultBrandId));
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, isCreating]);

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

  // Custom fields use the same delete-on-empty pattern as prices so a
  // cleared input doesn't leave a stale "" value on the product.
  const updateCustomField = (name: string, raw: string) => {
    setForm((f) => {
      const next = { ...(f.customFields ?? {}) };
      const trimmed = raw.trim();
      if (trimmed === '') {
        delete next[name];
      } else {
        next[name] = trimmed;
      }
      return { ...f, customFields: next };
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
      customFields: form.customFields ?? {},
      tags,
      status: form.status,
      expiryDate: form.expiryDate ?? null,
      taxRate: form.taxRate ?? null,
      reorderPoint: form.reorderPoint ?? null,
      reorderQuantity: form.reorderQuantity ?? null,
      trackInventory: form.trackInventory ?? false,
      variantAttributes: form.variantAttributes ?? null,
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

  // Empty-state placeholder for the inline side panel — shown when nothing
  // is selected and the user isn't creating. Matches Image Studio KH's
  // panel idle state: a centered card with a "+ New product" CTA so users
  // can start creating without going back to the toolbar.
  if (isEmpty) {
    return (
      <aside className="flex h-full min-h-0 flex-col rounded-lg border border-border-base bg-bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
          <h3 className="text-sm font-semibold text-fg-base">Product details</h3>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <div className="text-sm font-medium text-fg-base">No product selected</div>
          <p className="mx-auto mt-2 max-w-xs text-xs text-fg-muted">
            Click any product in the list to view and edit its details here,
            or start a new one.
          </p>
          {onStartCreate && (
            <div className="mt-5">
              <Button variant="primary" onClick={onStartCreate}>
                <IconPlus size={13} /> New product
              </Button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Inline side panel — NOT a modal. No backdrop, no fixed-inset,
          no Esc-to-close. Sits as the right column of the Products
          page layout. Per AGENTS.md §6, entity create/edit still uses
          explicit Cancel + Save (Create) — the side-panel form is the
          same try-then-commit semantics as the previous modal, just
          docked instead of overlaid. */}
      <aside
        aria-labelledby="product-form-title"
        className="flex h-full min-h-0 flex-col rounded-lg border border-border-base bg-bg-surface"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
            <h3
              id="product-form-title"
              className="truncate text-sm font-semibold text-fg-base"
            >
              {product ? `Edit ${product.sku}` : 'New product'}
            </h3>
            <button
              onClick={onClose}
              aria-label="Close panel"
              title="Close panel"
              className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-base"
            >
              <IconX size={16} />
            </button>
          </div>

          {/* Scrollable body. onPaste lives here so ⌘V anywhere inside the
              panel funnels images through the importer; non-image paste
              (e.g. into the description) keeps its default behavior.
              flex-1 + min-h-0 = take all remaining height in the panel
              without forcing the footer offscreen. */}
          <div
            className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4"
            onPaste={(e) => void onPaste(e)}
          >
            {error && (
              <div className="mb-3 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
                {error}
              </div>
            )}

            {/* Identity row */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label="Product Code *"
                hint="Required. Unique per brand. Trim whitespace; case-sensitive. (CSV column: Product Code)"
              >
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
              <Field label="Product Name">
                <TextInput
                  value={form.name ?? ''}
                  onChange={(e) => update('name', e.target.value || null)}
                />
              </Field>
              <Field label="Category Name">
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
              <Field label="Unit of Measure" hint="e.g. sqm, piece, box">
                <TextInput
                  value={form.unit ?? ''}
                  onChange={(e) => update('unit', e.target.value || null)}
                />
              </Field>
              <Field label="Variant Attributes" hint='e.g. "Color: Red, Size: M"'>
                <TextInput
                  value={form.variantAttributes ?? ''}
                  onChange={(e) =>
                    update('variantAttributes', e.target.value || null)
                  }
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

            {/* Custom fields — definitions come from /company → Custom
                product fields. One free-text input per defined name; the
                values land in product.customFields[name]. Section hides
                when the company hasn't defined any. */}
            {customFieldDefs.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-fg-subtle">
                  Custom fields
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {customFieldDefs.map((def) => (
                    <Field key={def.name} label={def.name}>
                      <TextInput
                        value={(form.customFields ?? {})[def.name] ?? ''}
                        onChange={(e) =>
                          updateCustomField(def.name, e.target.value)
                        }
                        placeholder=""
                      />
                    </Field>
                  ))}
                </div>
              </div>
            )}

            {/* Inventory & lifecycle — Label Studio stores these so they
                round-trip through CSV import/export with the user's
                external inventory system. The app itself doesn't act on
                them (no stock counters, no reorder alerts, no tax math).
                Free-text on purpose so non-numeric values survive. */}
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-fg-subtle">
                Inventory & lifecycle
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Expiry Date" hint="ISO yyyy-mm-dd. Leave blank if N/A.">
                  <TextInput
                    type="date"
                    value={form.expiryDate ?? ''}
                    onChange={(e) =>
                      update('expiryDate', e.target.value || null)
                    }
                  />
                </Field>
                <Field label="Tax Rate" hint="Percent, e.g. 10 for 10%.">
                  <TextInput
                    value={form.taxRate ?? ''}
                    onChange={(e) => update('taxRate', e.target.value || null)}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Reorder Point" hint="Units at which to reorder.">
                  <TextInput
                    value={form.reorderPoint ?? ''}
                    onChange={(e) =>
                      update('reorderPoint', e.target.value || null)
                    }
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Reorder Quantity" hint="Default reorder batch.">
                  <TextInput
                    value={form.reorderQuantity ?? ''}
                    onChange={(e) =>
                      update('reorderQuantity', e.target.value || null)
                    }
                    inputMode="numeric"
                  />
                </Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-fg-base">
                <input
                  type="checkbox"
                  checked={form.trackInventory ?? false}
                  onChange={(e) => update('trackInventory', e.target.checked)}
                />
                Track inventory — your external system treats this SKU as stock-tracked.
              </label>
            </div>

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
      </aside>

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
