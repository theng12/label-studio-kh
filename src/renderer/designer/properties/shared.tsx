import { useId } from 'react';
import {
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconLayoutAlignTop,
  IconLayoutAlignMiddle,
  IconLayoutAlignBottom,
} from '@tabler/icons-react';
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

// ── Alignment segmented controls ────────────────────────────────────────────
// Three-button toggle group used by every property panel that exposes
// `align` (horizontal) or `verticalAlign` (vertical). Mirrors the visual
// language of the designer's AlignmentToolbar so the user sees a consistent
// set of icons across "align this single element's content" (here) and
// "align these selected elements to each other" (toolbar).

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'center' | 'bottom';

export function AlignmentSegmented({
  value,
  onChange,
}: {
  value: HorizontalAlign;
  onChange: (next: HorizontalAlign) => void;
}) {
  const opts: Array<{ value: HorizontalAlign; Icon: typeof IconAlignLeft; title: string }> = [
    { value: 'left', Icon: IconAlignLeft, title: 'Align left' },
    { value: 'center', Icon: IconAlignCenter, title: 'Align center' },
    { value: 'right', Icon: IconAlignRight, title: 'Align right' },
  ];
  return (
    <div
      role="group"
      aria-label="Horizontal alignment"
      className="inline-flex rounded-md border border-border-base bg-bg-surface p-0.5"
    >
      {opts.map(({ value: v, Icon, title }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            title={title}
            aria-pressed={active}
            onClick={() => onChange(v)}
            className={[
              'flex h-7 w-9 items-center justify-center rounded transition-colors',
              active
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
            ].join(' ')}
          >
            <Icon size={14} stroke={1.75} />
          </button>
        );
      })}
    </div>
  );
}

export function VerticalAlignmentSegmented({
  value,
  onChange,
}: {
  value: VerticalAlign;
  onChange: (next: VerticalAlign) => void;
}) {
  const opts: Array<{ value: VerticalAlign; Icon: typeof IconLayoutAlignTop; title: string }> = [
    { value: 'top', Icon: IconLayoutAlignTop, title: 'Align top' },
    { value: 'center', Icon: IconLayoutAlignMiddle, title: 'Align middle' },
    { value: 'bottom', Icon: IconLayoutAlignBottom, title: 'Align bottom' },
  ];
  return (
    <div
      role="group"
      aria-label="Vertical alignment"
      className="inline-flex rounded-md border border-border-base bg-bg-surface p-0.5"
    >
      {opts.map(({ value: v, Icon, title }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            title={title}
            aria-pressed={active}
            onClick={() => onChange(v)}
            className={[
              'flex h-7 w-9 items-center justify-center rounded transition-colors',
              active
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
            ].join(' ')}
          >
            <Icon size={14} stroke={1.75} />
          </button>
        );
      })}
    </div>
  );
}

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
