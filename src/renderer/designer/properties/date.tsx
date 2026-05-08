import { type TemplateElement } from '../../../shared/types/template';
import { Field, ColorInput } from '../../components/FormField';
import { FontPicker } from '../../components/FontPicker';
import { NumberInput, formatPreviewSample } from './shared';

export function DateProperties({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'date' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  return (
    <>
      <Field label="Source">
        <select
          value={element.mode}
          onChange={(e) => {
            onPatch({
              mode: e.target.value as 'today' | 'static' | 'csv_column',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="today">Today (when generated)</option>
          <option value="static">Fixed date</option>
          <option value="csv_column">From CSV column</option>
        </select>
      </Field>
      {element.mode === 'static' && (
        <Field label="Date">
          <input
            type="date"
            value={element.staticDate || ''}
            onChange={(e) =>
              onPatch({ staticDate: e.target.value } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
          />
        </Field>
      )}
      {element.mode === 'csv_column' && (
        <Field label="CSV column">
          <input
            value={element.csvColumn}
            onChange={(e) =>
              onPatch({ csvColumn: e.target.value } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
            placeholder="date"
          />
        </Field>
      )}
      <Field
        label="Format"
        hint={
          element.formatStyle === 'custom'
            ? 'Tokens: YYYY MM DD'
            : `Preview: ${formatPreviewSample(element.formatStyle, element.format)}`
        }
      >
        <select
          value={element.formatStyle}
          onChange={(e) => {
            onPatch({
              formatStyle: e.target.value as
                | 'short'
                | 'long'
                | 'iso'
                | 'custom',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="short">Short — 06/05/2026</option>
          <option value="long">Long — 6 May 2026</option>
          <option value="iso">ISO — 2026-05-06</option>
          <option value="custom">Custom…</option>
        </select>
      </Field>
      {element.formatStyle === 'custom' && (
        <Field label="Custom format">
          <input
            value={element.format}
            onChange={(e) =>
              onPatch({ format: e.target.value } as Partial<TemplateElement>)
            }
            onBlur={onCommit}
            className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm font-mono"
            placeholder="DD/MM/YYYY"
          />
        </Field>
      )}
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
      <Field label="Align">
        <select
          value={element.align}
          onChange={(e) => {
            onPatch({
              align: e.target.value as 'left' | 'center' | 'right',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
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
