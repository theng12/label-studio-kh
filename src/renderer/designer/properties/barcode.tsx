import { type TemplateElement } from '../../../shared/types/template';
import { Field, ColorInput } from '../../components/FormField';
import { CsvColumnInput } from './shared';

export function BarcodeProperties({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'barcode' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  return (
    <>
      <Field
        label="Format"
        hint={
          element.format === 'EAN-13'
            ? 'Exactly 13 digits (12 + check digit).'
            : element.format === 'UPC-A'
              ? 'Exactly 12 digits.'
              : 'Any alphanumeric.'
        }
      >
        <select
          value={element.format}
          onChange={(e) => {
            onPatch({
              format: e.target.value as
                | 'EAN-13'
                | 'Code128'
                | 'Code39'
                | 'UPC-A',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option>EAN-13</option>
          <option>Code128</option>
          <option>Code39</option>
          <option>UPC-A</option>
        </select>
      </Field>

      <Field label="Source">
        <select
          value={element.dataSource}
          onChange={(e) => {
            onPatch({
              dataSource: e.target.value as 'csv_column' | 'manual',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="csv_column">From CSV column</option>
          <option value="manual">Manual / static value</option>
        </select>
      </Field>

      {element.dataSource === 'csv_column' ? (
        <Field
          label="CSV column"
          hint="Pick from the list or type any column name. The column should hold the barcode value for each row."
        >
          <CsvColumnInput
            value={element.csvColumn}
            onChange={(v) =>
              onPatch({ csvColumn: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
            placeholder="barcode"
          />
        </Field>
      ) : (
        <Field label="Value">
          <input
            value={element.manualValue}
            onChange={(e) =>
              onPatch({ manualValue: e.target.value } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            placeholder="8851234567890"
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono"
          />
        </Field>
      )}

      <label className="flex items-center gap-2 text-xs text-fg-base">
        <input
          type="checkbox"
          checked={element.showHumanReadable}
          onChange={(e) => {
            onPatch({
              showHumanReadable: e.target.checked,
            } as Partial<TemplateElement>);
            onCommit();
          }}
        />
        Show the value as text under the bars
      </label>

      <Field label="Bar color">
        <ColorInput
          value={element.barColor}
          onChange={(v) => {
            onPatch({ barColor: v } as Partial<TemplateElement>);
            onCommit();
          }}
        />
      </Field>
    </>
  );
}
