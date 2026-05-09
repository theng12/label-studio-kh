import { useId } from 'react';
import { formatDate, type DateFormatStyle } from '../../../shared/format';

export function formatPreviewSample(
  style: DateFormatStyle,
  custom: string,
): string {
  return formatDate(new Date(), style, custom);
}

export function NumberInput({
  value,
  onChange,
  onCommit,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
      onBlur={onCommit}
      className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
    />
  );
}

// Columns that exist on every product row at runtime — the keys produced by
// skuToRow() in pages/Generate.tsx. 'brand' is intentionally excluded
// (stored on the SKU as brand_id, not present on the row). Templates may
// also bind to user-defined CSV columns preserved in extra_json, so the
// picker is type-or-pick: pick from the list, or type any custom column
// name that exists on the imported rows.
export const PRODUCT_ROW_COLUMNS = [
  'sku',
  'product_name',
  'barcode',
  'description',
  'variant',
  'unit_qty',
  'unit_word',
  'product_url',
  'product_image_path',
  'date',
  'notes',
] as const;

export function CsvColumnInput({
  value,
  onChange,
  onCommit,
  placeholder,
  extraSuggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
  placeholder?: string;
  // Extra non-standard names to surface in the dropdown. Use for elements
  // whose conventional column isn't part of the import-mapped set
  // (e.g. country → 'country', price → 'price' / 'sale_price'). These come
  // through extra_json at runtime but are still fully supported.
  extraSuggestions?: readonly string[];
}) {
  const listId = useId();
  // Dedupe in case extraSuggestions overlaps with the standard set.
  const all = Array.from(
    new Set<string>([...PRODUCT_ROW_COLUMNS, ...(extraSuggestions ?? [])]),
  );
  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        placeholder={placeholder}
        className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      />
      <datalist id={listId}>
        {all.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
