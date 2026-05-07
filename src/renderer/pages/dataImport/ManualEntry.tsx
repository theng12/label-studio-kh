import { useEffect, useState } from 'react';
import { IconCheck, IconPlus, IconDeviceFloppy, IconX } from '@tabler/icons-react';
import { Button } from '../../components/Button';
import { useBrandStore } from '../../stores/brandStore';

type SkuRow = Awaited<ReturnType<typeof window.api.import.listSkus>>[number];

interface Props {
  // When provided, the form runs in "edit" mode: brand + SKU are locked,
  // the form is seeded from these values, and "Save and add another" is hidden.
  initialValues?: SkuRow | null;
  // Forces a particular brand (used by the edit dialog so the user can't
  // accidentally re-target the upsert at a different brand).
  lockedBrandId?: string;
  // Called after a successful save with the persisted row.
  onSaved?: (row: SkuRow) => void;
  // Optional cancel action — when present, replaces "Reset form".
  onCancel?: () => void;
}

const EMPTY_DRAFT = {
  sku: '',
  product_name: '',
  barcode: '',
  description: '',
  variant: '',
  unit_qty: '',
  unit_word: '',
  product_url: '',
  product_image_path: '',
  date: '',
  notes: '',
};

function seedFromRow(row: SkuRow | null | undefined): typeof EMPTY_DRAFT {
  if (!row) return EMPTY_DRAFT;
  return {
    sku: row.sku,
    product_name: row.product_name ?? '',
    barcode: row.barcode ?? '',
    description: row.description ?? '',
    variant: row.variant ?? '',
    unit_qty: row.unit_qty ?? '',
    unit_word: row.unit_word ?? '',
    product_url: row.product_url ?? '',
    product_image_path: row.product_image_path ?? '',
    date: row.date ?? '',
    notes: row.notes ?? '',
  };
}

export function ManualEntry({
  initialValues,
  lockedBrandId,
  onSaved,
  onCancel,
}: Props = {}) {
  const { brands } = useBrandStore();
  const isEdit = !!initialValues;

  const [brandId, setBrandId] = useState<string>(
    lockedBrandId ?? initialValues?.brand_id ?? brands[0]?.id ?? '',
  );
  const [draft, setDraft] = useState(() => seedFromRow(initialValues));
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<
    | null
    | { kind: 'created'; sku: string }
    | { kind: 'updated'; sku: string }
    | { kind: 'error'; message: string }
  >(null);

  // Re-seed when the dialog is opened on a different row.
  useEffect(() => {
    if (initialValues) {
      setDraft(seedFromRow(initialValues));
      setStatus(null);
    }
  }, [initialValues]);

  useEffect(() => {
    if (lockedBrandId) {
      setBrandId(lockedBrandId);
      return;
    }
    if (!brandId && brands.length > 0) setBrandId(brands[0]!.id);
  }, [brands, brandId, lockedBrandId]);

  const set = (patch: Partial<typeof draft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const reset = () => setDraft(EMPTY_DRAFT);

  const onSave = async (andAddAnother: boolean) => {
    if (!brandId || !draft.sku.trim()) return;
    setSubmitting(true);
    setStatus(null);
    try {
      // Detect "created" vs "updated" so we can give honest feedback.
      const existing = await window.api.sku.get(brandId, draft.sku.trim());
      const result = await window.api.sku.upsert({
        sku: draft.sku.trim(),
        brand_id: brandId,
        product_name: draft.product_name || null,
        barcode: draft.barcode || null,
        description: draft.description || null,
        variant: draft.variant || null,
        unit_qty: draft.unit_qty || null,
        unit_word: draft.unit_word || null,
        product_url: draft.product_url || null,
        product_image_path: draft.product_image_path || null,
        date: draft.date || null,
        notes: draft.notes || null,
      });
      if (!result) {
        setStatus({ kind: 'error', message: 'Save failed (no result returned).' });
        return;
      }
      setStatus({
        kind: existing ? 'updated' : 'created',
        sku: result.sku,
      });
      if (andAddAnother) reset();
      onSaved?.(result);
    } catch (err) {
      setStatus({ kind: 'error', message: String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (brands.length === 0) return null;

  return (
    <div className="space-y-4">
      {!isEdit && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-muted">Add to brand</span>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm text-fg-base"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {status && (
        <div
          className={[
            'rounded-md border p-3 text-sm',
            status.kind === 'error'
              ? 'border-danger/40 bg-danger/10 text-danger'
              : 'border-success/40 bg-success/10 text-success',
          ].join(' ')}
        >
          {status.kind === 'created' && (
            <span className="flex items-center gap-2">
              <IconCheck size={14} /> Created SKU <strong>{status.sku}</strong>.
            </span>
          )}
          {status.kind === 'updated' && (
            <span className="flex items-center gap-2">
              <IconCheck size={14} /> Updated existing SKU{' '}
              <strong>{status.sku}</strong>.
            </span>
          )}
          {status.kind === 'error' && status.message}
        </div>
      )}

      <div className="rounded-lg border border-border-base bg-bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ManualField
            label="SKU"
            required
            value={draft.sku}
            onChange={(v) => set({ sku: v })}
            placeholder="e.g. GH-001"
            mono
            // Locking the SKU in edit mode keeps the upsert key stable —
            // changing it would create a new row instead of editing this one.
            disabled={isEdit}
          />
          <ManualField
            label="Product name"
            required
            value={draft.product_name}
            onChange={(v) => set({ product_name: v })}
            placeholder="Stainless Grab Bar 60cm"
          />
          <ManualField
            label="Barcode"
            value={draft.barcode}
            onChange={(v) => set({ barcode: v })}
            placeholder="8851234567890"
            mono
            hint="EAN-13, Code128, etc. Leave blank if no barcode."
          />
          <ManualField
            label="Variant"
            value={draft.variant}
            onChange={(v) => set({ variant: v })}
            placeholder="SATIN, WHITE, 60cm"
          />
          <ManualField
            label="Description"
            value={draft.description}
            onChange={(v) => set({ description: v })}
            placeholder="Short product benefit"
          />
          <div className="grid grid-cols-2 gap-3">
            <ManualField
              label="Unit qty"
              value={draft.unit_qty}
              onChange={(v) => set({ unit_qty: v })}
              placeholder="1"
            />
            <ManualField
              label="Unit word"
              value={draft.unit_word}
              onChange={(v) => set({ unit_word: v })}
              placeholder="UNIT, SET, PCS"
            />
          </div>
          <ManualField
            label="Product URL"
            value={draft.product_url}
            onChange={(v) => set({ product_url: v })}
            placeholder="https://example.com/p/sku"
            hint="Used by dynamic QR code elements."
          />
          <ManualField
            label="Image path"
            value={draft.product_image_path}
            onChange={(v) => set({ product_image_path: v })}
            placeholder="images/grab-bar-60.jpg"
            hint="Used by image elements bound to a CSV column."
          />
          <ManualField
            label="Date"
            value={draft.date}
            onChange={(v) => set({ date: v })}
            placeholder="DD/MM/YYYY"
          />
          <ManualField
            label="Notes"
            value={draft.notes}
            onChange={(v) => set({ notes: v })}
            placeholder="Internal — not printed"
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              <IconX size={14} /> Cancel
            </Button>
          ) : (
            <Button variant="ghost" onClick={reset} disabled={submitting}>
              Reset form
            </Button>
          )}
          {!isEdit && (
            <Button
              variant="secondary"
              onClick={() => void onSave(true)}
              disabled={submitting || !draft.sku.trim() || !draft.product_name.trim()}
            >
              <IconPlus size={14} /> Save and add another
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => void onSave(false)}
            disabled={submitting || !draft.sku.trim() || !draft.product_name.trim()}
          >
            <IconDeviceFloppy size={14} />{' '}
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Save SKU'}
          </Button>
        </div>
      </div>

      {!isEdit && (
        <div className="rounded-md border border-border-subtle bg-bg-base px-4 py-3 text-xs text-fg-muted">
          Saving an existing SKU (same brand + same SKU code) updates the row rather
          than creating a duplicate. To edit or remove a SKU, click the row on the
          SKU lookup tab.
        </div>
      )}
    </div>
  );
}

function ManualField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  mono,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  mono?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-fg-muted">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={[
          'mt-1 w-full rounded-md border border-border-base bg-bg-base px-2 py-1.5 text-sm text-fg-base placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
          mono ? 'font-mono' : '',
          disabled ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
      />
      {hint && <div className="mt-1 text-[10px] text-fg-subtle">{hint}</div>}
    </label>
  );
}
