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
