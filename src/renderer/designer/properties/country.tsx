import { type TemplateElement } from '../../../shared/types/template';
import { Field, ColorInput } from '../../components/FormField';
import { FontPicker } from '../../components/FontPicker';
import {
  AlignmentSegmented,
  CsvColumnInput,
  NumberInput,
  type HorizontalAlign,
} from './shared';

export function CountryProperties({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'country' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  return (
    <>
      <Field label="Source">
        <select
          value={element.source}
          onChange={(e) => {
            onPatch({
              source: e.target.value as 'static' | 'csv_column',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="static">Static</option>
          <option value="csv_column">From CSV column</option>
        </select>
      </Field>
      {element.source === 'static' ? (
        <Field label="Country name">
          <input
            value={element.staticCountry}
            onChange={(e) =>
              onPatch({ staticCountry: e.target.value } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
            placeholder="Cambodia"
          />
        </Field>
      ) : (
        <Field
          label="CSV column"
          hint="Pick from the list or type any column name. The column should hold a country name or ISO code per row."
        >
          <CsvColumnInput
            value={element.csvColumn}
            onChange={(v) =>
              onPatch({ csvColumn: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
            placeholder="country"
            extraSuggestions={['country']}
          />
        </Field>
      )}
      <Field
        label="ISO 2-letter code"
        hint="Used for the flag emoji. KH = 🇰🇭, US = 🇺🇸, GB = 🇬🇧."
      >
        <input
          value={element.countryCode}
          onChange={(e) =>
            onPatch({
              countryCode: e.target.value.toUpperCase().slice(0, 2),
            } as Partial<TemplateElement>)
          }
          onBlur={onCommit}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono uppercase"
          placeholder="KH"
          maxLength={2}
        />
      </Field>
      <Field label="Prefix">
        <input
          value={element.prefix}
          onChange={(e) =>
            onPatch({ prefix: e.target.value } as Partial<TemplateElement>)
          }
          onBlur={onCommit}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          placeholder="Made in"
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={element.showFlag}
            onChange={(e) => {
              onPatch({ showFlag: e.target.checked } as Partial<TemplateElement>);
              onCommit();
            }}
          />
          Flag
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={element.showName}
            onChange={(e) => {
              onPatch({ showName: e.target.checked } as Partial<TemplateElement>);
              onCommit();
            }}
          />
          Name
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={element.showCode}
            onChange={(e) => {
              onPatch({ showCode: e.target.checked } as Partial<TemplateElement>);
              onCommit();
            }}
          />
          Code
        </label>
      </div>
      <Field label="Font">
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
        <Field label="Align">
          <AlignmentSegmented
            value={element.align}
            onChange={(v: HorizontalAlign) => {
              onPatch({ align: v } as Partial<TemplateElement>);
              onCommit();
            }}
          />
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
    </>
  );
}
