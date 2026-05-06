import { useDesignerStore } from '../stores/designerStore';
import type { TemplateElement } from '../../shared/types/template';
import { IconTrash, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { Button } from '../components/Button';
import { Field, ColorInput } from '../components/FormField';

export function Properties() {
  const template = useDesignerStore((s) => s.template);
  const selectedIds = useDesignerStore((s) => s.selectedIds);
  const updateElement = useDesignerStore((s) => s.updateElement);
  const removeSelected = useDesignerStore((s) => s.removeSelected);
  const bringToFront = useDesignerStore((s) => s.bringToFront);
  const sendToBack = useDesignerStore((s) => s.sendToBack);
  const patchTemplate = useDesignerStore((s) => s.patchTemplate);
  const setDimensions = useDesignerStore((s) => s.setDimensions);
  const pushHistory = useDesignerStore((s) => s.pushHistory);

  if (!template) return null;

  if (selectedIds.length === 0) {
    return (
      <TemplateProperties
        template={template}
        onPatch={patchTemplate}
        onSetDimensions={setDimensions}
      />
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div className="p-4 text-xs text-fg-muted">
        {selectedIds.length} elements selected.
      </div>
    );
  }

  const el = template.elements.find((e) => e.id === selectedIds[0]);
  if (!el) return null;

  return (
    <ElementProperties
      element={el}
      onPatch={(patch) => {
        updateElement(el.id, patch);
      }}
      onCommit={pushHistory}
      onDelete={removeSelected}
      onBringFront={() => bringToFront(el.id)}
      onSendBack={() => sendToBack(el.id)}
    />
  );
}

function TemplateProperties({
  template,
  onPatch,
  onSetDimensions,
}: {
  template: NonNullable<ReturnType<typeof useDesignerStore.getState>['template']>;
  onPatch: (p: Partial<typeof template>) => void;
  onSetDimensions: (w: number, h: number) => void;
}) {
  return (
    <div className="space-y-3 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
        Template
      </div>
      <Field label="Name">
        <input
          value={template.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm text-fg-base focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width (mm)">
          <NumberInput
            value={template.width_mm}
            onChange={(v) => onSetDimensions(v, template.height_mm)}
          />
        </Field>
        <Field label="Height (mm)">
          <NumberInput
            value={template.height_mm}
            onChange={(v) => onSetDimensions(template.width_mm, v)}
          />
        </Field>
      </div>
      <Field label="Background">
        <ColorInput
          value={template.background}
          onChange={(v) => onPatch({ background: v })}
        />
      </Field>
      <div className="text-[10px] text-fg-subtle">
        Orientation: {template.orientation} (set automatically by W and H).
      </div>
    </div>
  );
}

function ElementProperties({
  element,
  onPatch,
  onCommit,
  onDelete,
  onBringFront,
  onSendBack,
}: {
  element: TemplateElement;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
  onDelete: () => void;
  onBringFront: () => void;
  onSendBack: () => void;
}) {
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
            {element.type}
          </div>
          <div className="text-sm font-medium text-fg-base">
            {element.name ?? element.type}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onBringFront} title="Bring to front">
            <IconArrowUp size={12} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onSendBack} title="Send to back">
            <IconArrowDown size={12} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} title="Delete">
            <IconTrash size={12} />
          </Button>
        </div>
      </div>

      <Field label="Name">
        <input
          value={element.name ?? ''}
          onChange={(e) =>
            onPatch({ name: e.target.value } as Partial<TemplateElement>)
          }
          onBlur={onCommit}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm text-fg-base"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X (mm)">
          <NumberInput
            value={element.x_mm}
            step={0.1}
            onChange={(v) =>
              onPatch({ x_mm: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
          />
        </Field>
        <Field label="Y (mm)">
          <NumberInput
            value={element.y_mm}
            step={0.1}
            onChange={(v) =>
              onPatch({ y_mm: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
          />
        </Field>
        <Field label="W (mm)">
          <NumberInput
            value={element.width_mm}
            step={0.1}
            onChange={(v) =>
              onPatch({ width_mm: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
          />
        </Field>
        <Field label="H (mm)">
          <NumberInput
            value={element.height_mm}
            step={0.1}
            onChange={(v) =>
              onPatch({ height_mm: v } as Partial<TemplateElement>)
            }
            onCommit={onCommit}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-fg-base">
          <input
            type="checkbox"
            checked={element.visible}
            onChange={(e) => {
              onPatch({ visible: e.target.checked } as Partial<TemplateElement>);
              onCommit();
            }}
          />
          Visible
        </label>
        <label className="flex items-center gap-1.5 text-xs text-fg-base">
          <input
            type="checkbox"
            checked={element.locked}
            onChange={(e) => {
              onPatch({ locked: e.target.checked } as Partial<TemplateElement>);
              onCommit();
            }}
          />
          Locked
        </label>
      </div>

      <TypeSpecificFields element={element} onPatch={onPatch} onCommit={onCommit} />
    </div>
  );
}

function TypeSpecificFields({
  element,
  onPatch,
  onCommit,
}: {
  element: TemplateElement;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  switch (element.type) {
    case 'text':
    case 'sku': {
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
                  dataSource: e.target.value as 'static' | 'csv_column',
                } as Partial<TemplateElement>);
                onCommit();
              }}
              className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
            >
              <option value="static">Static text</option>
              <option value="csv_column">From CSV column</option>
            </select>
          </Field>
          {element.dataSource === 'static' ? (
            <Field
              label="Static text"
              hint={
                cap
                  ? `${currentLen} / ${cap} characters${currentLen > cap ? ' — will be truncated with …' : ''}`
                  : undefined
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
          ) : (
            <Field label="CSV column">
              <input
                value={element.csvColumn}
                onChange={(e) =>
                  onPatch({ csvColumn: e.target.value } as Partial<TemplateElement>)
                }
                onBlur={onCommit}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
              />
            </Field>
          )}
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

    case 'colorbar':
      return (
        <Field label="Color">
          <ColorInput
            value={element.color}
            onChange={(v) => {
              onPatch({ color: v } as Partial<TemplateElement>);
              onCommit();
            }}
          />
        </Field>
      );

    case 'rect':
      return (
        <>
          <Field label="Fill">
            <ColorInput
              value={element.fillColor}
              onChange={(v) => {
                onPatch({ fillColor: v } as Partial<TemplateElement>);
                onCommit();
              }}
            />
          </Field>
          <Field label="Border">
            <ColorInput
              value={element.borderColor}
              onChange={(v) => {
                onPatch({ borderColor: v } as Partial<TemplateElement>);
                onCommit();
              }}
            />
          </Field>
        </>
      );

    case 'qr':
      return (
        <Field label="Mode">
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
            <option value="custom">Custom per product</option>
          </select>
        </Field>
      );

    case 'barcode':
      return (
        <Field label="Format">
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
      );

    default:
      return null;
  }
}

function NumberInput({
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
