import { type TemplateElement } from '../../../shared/types/template';
import { Field, ColorInput } from '../../components/FormField';
import { FontPicker } from '../../components/FontPicker';
import { CsvColumnInput, NumberInput } from './shared';

export function TextProperties({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'text' | 'sku' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  const currentLen =
    element.dataSource === 'static' ? element.staticText.length : 0;
  const cap = element.maxChars ?? null;
  return (
    <>
      <Field label="Source">
        <select
          value={element.dataSource}
          onChange={(e) => {
            onPatch({
              dataSource: e.target.value as
                | 'static'
                | 'csv_column'
                | 'brand_field',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="static">Static text</option>
          <option value="csv_column">From CSV column (per product)</option>
          <option value="brand_field">From brand info (address, phone, …)</option>
        </select>
      </Field>
      {element.dataSource === 'static' && (
        <Field
          label="Static text"
          hint={
            cap
              ? `${currentLen} / ${cap} characters${currentLen > cap ? ' — will be truncated with …' : ''}. Tip: use {column_name} to mix in row data (e.g. "1 UNIT OF {product_name}").`
              : 'Tip: use {column_name} to mix in row data (e.g. "1 UNIT OF {product_name}"). Unknown columns render as-is so typos are visible.'
          }
        >
          <input
            value={element.staticText}
            onChange={(e) =>
              onPatch({ staticText: e.target.value } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            className={[
              'w-full rounded-md border bg-bg-surface px-2 py-1.5 text-sm',
              cap && currentLen > cap
                ? 'border-warning focus:border-warning focus:ring-1 focus:ring-warning'
                : 'border-border-base focus:border-accent focus:ring-1 focus:ring-accent',
            ].join(' ')}
          />
        </Field>
      )}
      {element.dataSource === 'csv_column' && (
        <Field
          label="CSV column"
          hint="Pick from the list or type any column name from your imported data."
        >
          <CsvColumnInput
            value={element.csvColumn}
            onChange={(v) =>
              onPatch({ csvColumn: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
            placeholder="product_name"
          />
        </Field>
      )}
      {element.dataSource === 'brand_field' && (
        <Field
          label="Brand field"
          hint="Pulls live from this brand's stored info. Edit on the brand and the labels update automatically."
        >
          <select
            value={element.brandField ?? 'address'}
            onChange={(e) => {
              onPatch({
                brandField: e.target.value as
                  | 'address'
                  | 'phone'
                  | 'email'
                  | 'website'
                  | 'tagline'
                  | 'customerCareLabel',
              } as Partial<TemplateElement>);
              onCommit();
            }}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          >
            <option value="address">Address</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="website">Website</option>
            <option value="tagline">Tagline</option>
            <option value="customerCareLabel">Customer care label</option>
          </select>
        </Field>
      )}
      <Field
        label="Font"
        hint="Pick a bundled font for cross-machine consistency, or any font installed on your computer."
      >
        <FontPicker
          value={element.fontFamily}
          onChange={(v) =>
            onPatch({ fontFamily: v } as Partial<TemplateElement>)
          }
          onCommit={onCommit}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Font size (pt)">
          <NumberInput
            value={element.fontSize}
            step={0.5}
            onChange={(v) =>
              onPatch({ fontSize: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
          />
        </Field>
        <Field label="Weight">
          <select
            value={element.fontWeight}
            onChange={(e) => {
              onPatch({
                fontWeight: e.target.value as 'normal' | 'bold',
              } as Partial<TemplateElement>);
              onCommit();
            }}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </Field>
      </div>
      <Field label="Color">
        <ColorInput
          value={element.color}
          onChange={(v) => {
            onPatch({ color: v } as Partial<TemplateElement>);
            onCommit();
          }}
        />
      </Field>
      {element.type === 'text' && (
        <>
          <label className="flex items-center gap-2 text-xs text-fg-base">
            <input
              type="checkbox"
              checked={element.multiline ?? false}
              onChange={(e) => {
                onPatch({
                  multiline: e.target.checked,
                } as Partial<TemplateElement>);
                onCommit();
              }}
            />
            Multi-line (wrap text inside the box)
          </label>
          {element.multiline && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Line height" hint="1.0 = tight, 1.4 = airy">
                <NumberInput
                  value={element.lineHeight ?? 1.2}
                  step={0.1}
                  onChange={(v) =>
                    onPatch({ lineHeight: v } as Partial<TemplateElement>)
                  }
                  onCommit={onCommit}
                />
              </Field>
              <Field label="Vertical align">
                <select
                  value={element.verticalAlign ?? 'top'}
                  onChange={(e) => {
                    onPatch({
                      verticalAlign: e.target.value as
                        | 'top'
                        | 'center'
                        | 'bottom',
                    } as Partial<TemplateElement>);
                    onCommit();
                  }}
                  className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                >
                  <option value="top">Top</option>
                  <option value="center">Center</option>
                  <option value="bottom">Bottom</option>
                </select>
              </Field>
            </div>
          )}
        </>
      )}
      <Field
        label="Max characters"
        hint={
          cap
            ? 'Resolved text longer than this is truncated with "…"'
            : 'Leave blank to allow any length.'
        }
      >
        <input
          type="number"
          min={1}
          value={cap ?? ''}
          placeholder="(no limit)"
          onChange={(e) => {
            const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
            onPatch({
              maxChars: Number.isNaN(v as number) ? null : v,
            } as Partial<TemplateElement>);
          }}
          onBlur={onCommit}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        />
      </Field>
    </>
  );
}
