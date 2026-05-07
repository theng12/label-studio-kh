import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        setStatus({ kind: 'error', message: t('dataImport.manual.saveFailed') });
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
          <span className="text-xs text-fg-muted">{t('dataImport.manual.addToBrand')}</span>
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
              <IconCheck size={14} /> {t('dataImport.manual.created', { sku: status.sku })}
            </span>
          )}
          {status.kind === 'updated' && (
            <span className="flex items-center gap-2">
              <IconCheck size={14} /> {t('dataImport.manual.updated', { sku: status.sku })}
            </span>
          )}
          {status.kind === 'error' && status.message}
        </div>
      )}

      <div className="rounded-lg border border-border-base bg-bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ManualField
            label={t('dataImport.manual.fields.sku')}
            required
            value={draft.sku}
            onChange={(v) => set({ sku: v })}
            placeholder={t('dataImport.manual.fields.skuPlaceholder')}
            mono
            // Locking the SKU in edit mode keeps the upsert key stable —
            // changing it would create a new row instead of editing this one.
            disabled={isEdit}
          />
          <ManualField
            label={t('dataImport.manual.fields.productName')}
            required
            value={draft.product_name}
            onChange={(v) => set({ product_name: v })}
            placeholder={t('dataImport.manual.fields.productNamePlaceholder')}
          />
          <ManualField
            label={t('dataImport.manual.fields.barcode')}
            value={draft.barcode}
            onChange={(v) => set({ barcode: v })}
            placeholder={t('dataImport.manual.fields.barcodePlaceholder')}
            mono
            hint={t('dataImport.manual.fields.barcodeHint')}
          />
          <ManualField
            label={t('dataImport.manual.fields.variant')}
            value={draft.variant}
            onChange={(v) => set({ variant: v })}
            placeholder={t('dataImport.manual.fields.variantPlaceholder')}
          />
          <ManualField
            label={t('dataImport.manual.fields.description')}
            value={draft.description}
            onChange={(v) => set({ description: v })}
            placeholder={t('dataImport.manual.fields.descriptionPlaceholder')}
          />
          <div className="grid grid-cols-2 gap-3">
            <ManualField
              label={t('dataImport.manual.fields.unitQty')}
              value={draft.unit_qty}
              onChange={(v) => set({ unit_qty: v })}
              placeholder="1"
            />
            <ManualField
              label={t('dataImport.manual.fields.unitWord')}
              value={draft.unit_word}
              onChange={(v) => set({ unit_word: v })}
              placeholder={t('dataImport.manual.fields.unitWordPlaceholder')}
            />
          </div>
          <ManualField
            label={t('dataImport.manual.fields.productUrl')}
            value={draft.product_url}
            onChange={(v) => set({ product_url: v })}
            placeholder={t('dataImport.manual.fields.productUrlPlaceholder')}
            hint={t('dataImport.manual.fields.productUrlHint')}
          />
          <ManualField
            label={t('dataImport.manual.fields.imagePath')}
            value={draft.product_image_path}
            onChange={(v) => set({ product_image_path: v })}
            placeholder={t('dataImport.manual.fields.imagePathPlaceholder')}
            hint={t('dataImport.manual.fields.imagePathHint')}
          />
          <ManualField
            label={t('dataImport.manual.fields.date')}
            value={draft.date}
            onChange={(v) => set({ date: v })}
            placeholder={t('dataImport.manual.fields.datePlaceholder')}
          />
          <ManualField
            label={t('dataImport.manual.fields.notes')}
            value={draft.notes}
            onChange={(v) => set({ notes: v })}
            placeholder={t('dataImport.manual.fields.notesPlaceholder')}
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              <IconX size={14} /> {t('dataImport.manual.cancel')}
            </Button>
          ) : (
            <Button variant="ghost" onClick={reset} disabled={submitting}>
              {t('dataImport.manual.reset')}
            </Button>
          )}
          {!isEdit && (
            <Button
              variant="secondary"
              onClick={() => void onSave(true)}
              disabled={submitting || !draft.sku.trim() || !draft.product_name.trim()}
            >
              <IconPlus size={14} /> {t('dataImport.manual.saveAndAdd')}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => void onSave(false)}
            disabled={submitting || !draft.sku.trim() || !draft.product_name.trim()}
          >
            <IconDeviceFloppy size={14} />{' '}
            {submitting
              ? t('dataImport.manual.saving')
              : isEdit
                ? t('dataImport.manual.saveChanges')
                : t('dataImport.manual.saveSku')}
          </Button>
        </div>
      </div>

      {!isEdit && (
        <div className="rounded-md border border-border-subtle bg-bg-base px-4 py-3 text-xs text-fg-muted">
          {t('dataImport.manual.helperHint')}
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
