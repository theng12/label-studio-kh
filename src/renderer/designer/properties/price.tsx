import { type TemplateElement } from '../../../shared/types/template';
import { Field, ColorInput } from '../../components/FormField';
import { FontPicker } from '../../components/FontPicker';
import {
  AlignmentSegmented,
  CsvColumnInput,
  NumberInput,
  type HorizontalAlign,
} from './shared';

export function PriceProperties({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'price' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  return (
    <>
      <Field label="Regular price source">
        <select
          value={element.amountSource}
          onChange={(e) => {
            onPatch({
              amountSource: e.target.value as 'static' | 'csv_column',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="static">Static</option>
          <option value="csv_column">From CSV column</option>
        </select>
      </Field>
      {element.amountSource === 'static' ? (
        <Field label="Regular price">
          <input
            value={element.amountStatic}
            onChange={(e) =>
              onPatch({ amountStatic: e.target.value } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono"
            placeholder="9.99"
          />
        </Field>
      ) : (
        <Field
          label="Price column"
          hint="Pick from the list or type any column name. The column should hold a numeric price per row."
        >
          <CsvColumnInput
            value={element.amountCsvColumn}
            onChange={(v) =>
              onPatch({ amountCsvColumn: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
            placeholder="price"
            extraSuggestions={['price']}
          />
        </Field>
      )}
      <Field
        label="Sale price"
        hint="When set, the regular price gets a strikethrough and the sale price is the prominent number."
      >
        <select
          value={element.salePriceSource}
          onChange={(e) => {
            onPatch({
              salePriceSource: e.target.value as 'none' | 'static' | 'csv_column',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="none">None</option>
          <option value="static">Static</option>
          <option value="csv_column">From CSV column</option>
        </select>
      </Field>
      {element.salePriceSource === 'static' && (
        <Field label="Sale price (static)">
          <input
            value={element.salePriceStatic}
            onChange={(e) =>
              onPatch({ salePriceStatic: e.target.value } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono"
            placeholder="7.99"
          />
        </Field>
      )}
      {element.salePriceSource === 'csv_column' && (
        <Field
          label="Sale price column"
          hint="Pick from the list or type any column name."
        >
          <CsvColumnInput
            value={element.salePriceCsvColumn}
            onChange={(v) =>
              onPatch({ salePriceCsvColumn: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
            placeholder="sale_price"
            extraSuggestions={['sale_price']}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Currency symbol">
          <input
            value={element.currency}
            onChange={(e) =>
              onPatch({ currency: e.target.value } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
            placeholder="$ € £ ฿ ៛"
          />
        </Field>
        <Field label="Position">
          <select
            value={element.currencyPosition}
            onChange={(e) => {
              onPatch({
                currencyPosition: e.target.value as 'before' | 'after',
              } as Partial<TemplateElement>);
              onCommit();
            }}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          >
            <option value="before">Before ($9.99)</option>
            <option value="after">After (9.99 €)</option>
          </select>
        </Field>
        <Field label="Thousands sep.">
          <select
            value={element.thousandsSeparator}
            onChange={(e) => {
              onPatch({
                thousandsSeparator: e.target.value as ',' | '.' | ' ' | '',
              } as Partial<TemplateElement>);
              onCommit();
            }}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          >
            <option value=",">Comma (1,234)</option>
            <option value=".">Period (1.234)</option>
            <option value=" ">Space (1 234)</option>
            <option value="">None (1234)</option>
          </select>
        </Field>
        <Field label="Decimals">
          <NumberInput
            value={element.decimals}
            step={1}
            onChange={(v) =>
              onPatch({ decimals: Math.max(0, Math.round(v)) } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
          />
        </Field>
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
        <Field label="Font size">
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
      {element.salePriceSource !== 'none' && (
        <Field label="Strikethrough color">
          <ColorInput
            value={element.saleColor}
            onChange={(v) => {
              onPatch({ saleColor: v } as Partial<TemplateElement>);
              onCommit();
            }}
          />
        </Field>
      )}
      <Field label="Align">
        <AlignmentSegmented
          value={element.align}
          onChange={(v: HorizontalAlign) => {
            onPatch({ align: v } as Partial<TemplateElement>);
            onCommit();
          }}
        />
      </Field>
    </>
  );
}
