import { type TemplateElement } from '../../../shared/types/template';
import { Field } from '../../components/FormField';
import { CsvColumnInput } from './shared';

export function QRProperties({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'qr' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  return (
    <>
      <Field
        label="Mode"
        hint={
          element.mode === 'static'
            ? 'Same URL on every label.'
            : element.mode === 'dynamic_sku'
              ? "Each label's URL = base URL + the row's SKU."
              : 'Each row supplies its own full URL via a CSV column.'
        }
      >
        <select
          value={element.mode}
          onChange={(e) => {
            onPatch({
              mode: e.target.value as
                | 'static'
                | 'dynamic_sku'
                | 'dynamic_csv'
                | 'custom',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="static">Static URL</option>
          <option value="dynamic_sku">Base URL + SKU</option>
          <option value="dynamic_csv">From CSV column</option>
          <option value="custom">Custom per product (CSV column)</option>
        </select>
      </Field>

      {element.mode === 'static' && (
        <Field label="URL">
          <input
            value={element.staticUrl}
            onChange={(e) =>
              onPatch({ staticUrl: e.target.value } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            placeholder="https://example.com"
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono"
          />
        </Field>
      )}

      {element.mode === 'dynamic_sku' && (
        <Field
          label="Base URL"
          hint="The row's SKU is appended directly. Include a trailing / if you need one."
        >
          <input
            value={element.dynamicBaseUrl}
            onChange={(e) =>
              onPatch({
                dynamicBaseUrl: e.target.value,
              } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            placeholder="https://example.com/p/"
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono"
          />
        </Field>
      )}

      {(element.mode === 'dynamic_csv' || element.mode === 'custom') && (
        <Field
          label="CSV column"
          hint="Pick from the list or type any column name. The column should contain a full URL for each row."
        >
          <CsvColumnInput
            value={element.csvColumn}
            onChange={(v) =>
              onPatch({ csvColumn: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
            placeholder="product_url"
          />
        </Field>
      )}

      <Field
        label="Error correction"
        hint="Higher levels survive more damage but encode less data."
      >
        <select
          value={element.errorCorrection}
          onChange={(e) => {
            onPatch({
              errorCorrection: e.target.value as 'L' | 'M' | 'Q' | 'H',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="L">L — Low (~7% damage tolerance)</option>
          <option value="M">M — Medium (~15%)</option>
          <option value="Q">Q — Quartile (~25%)</option>
          <option value="H">H — High (~30%)</option>
        </select>
      </Field>

      <label className="flex items-center gap-2 text-xs text-fg-base">
        <input
          type="checkbox"
          checked={element.showUrlText}
          onChange={(e) => {
            onPatch({
              showUrlText: e.target.checked,
            } as Partial<TemplateElement>);
            onCommit();
          }}
        />
        Show the URL as small text under the QR
      </label>
    </>
  );
}
