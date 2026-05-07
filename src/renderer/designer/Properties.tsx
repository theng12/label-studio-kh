import { useDesignerStore } from '../stores/designerStore';
import { useBrandStore } from '../stores/brandStore';
import {
  defaultAspectLock,
  isAspectLocked,
  type TemplateElement,
} from '../../shared/types/template';
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

      <div className="flex flex-wrap items-center gap-3">
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
        <label
          className="flex items-center gap-1.5 text-xs text-fg-base"
          title="When on, drag-resize keeps the current width/height ratio. Hold Shift while resizing to invert temporarily."
        >
          <input
            type="checkbox"
            checked={isAspectLocked(element)}
            onChange={(e) => {
              const def = defaultAspectLock(element.type);
              const next = e.target.checked;
              // Store undefined when matching the default so old templates and
              // new ones stay clean; explicit boolean only when user diverges.
              onPatch({
                aspectLocked: next === def ? undefined : next,
              } as Partial<TemplateElement>);
              onCommit();
            }}
          />
          Lock ratio
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
          )}
          {element.dataSource === 'csv_column' && (
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

    case 'price':
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
            <Field label="Price column">
              <input
                value={element.amountCsvColumn}
                onChange={(e) =>
                  onPatch({ amountCsvColumn: e.target.value } as Partial<TemplateElement>)
                }
                onBlur={onCommit}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                placeholder="price"
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
            <Field label="Sale price column">
              <input
                value={element.salePriceCsvColumn}
                onChange={(e) =>
                  onPatch({ salePriceCsvColumn: e.target.value } as Partial<TemplateElement>)
                }
                onBlur={onCommit}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                placeholder="sale_price"
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
        </>
      );

    case 'country':
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
            <Field label="CSV column">
              <input
                value={element.csvColumn}
                onChange={(e) =>
                  onPatch({ csvColumn: e.target.value } as Partial<TemplateElement>)
                }
                onBlur={onCommit}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                placeholder="country"
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

    case 'logo':
      return <LogoFields element={element} onPatch={onPatch} onCommit={onCommit} />;

    case 'image':
      return (
        <>
          <Field label="Source">
            <select
              value={element.dataSource}
              onChange={(e) => {
                onPatch({
                  dataSource: e.target.value as
                    | 'static_asset'
                    | 'csv_column_path',
                } as Partial<TemplateElement>);
                onCommit();
              }}
              className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
            >
              <option value="csv_column_path">From CSV column</option>
              <option value="static_asset">Static file</option>
            </select>
          </Field>
          {element.dataSource === 'csv_column_path' ? (
            <Field
              label="CSV column"
              hint="The column should contain a file path on disk OR a URL (https://…). Both work."
            >
              <input
                value={element.csvColumn}
                onChange={(e) =>
                  onPatch({
                    csvColumn: e.target.value,
                  } as Partial<TemplateElement>)
                }
                onBlur={onCommit}
                className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                placeholder="product_image_path"
              />
            </Field>
          ) : (
            <Field
              label="File path"
              hint="Absolute path on disk, or a URL. Use the Pick button to browse."
            >
              <div className="flex gap-2">
                <input
                  value={element.assetPath}
                  onChange={(e) =>
                    onPatch({
                      assetPath: e.target.value,
                    } as Partial<TemplateElement>)
                  }
                  onBlur={onCommit}
                  className="flex-1 rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
                  placeholder="/path/to/image.png"
                />
                <button
                  onClick={async () => {
                    const path = await window.api.dialog.pickImage();
                    if (path) {
                      onPatch({
                        assetPath: path,
                      } as Partial<TemplateElement>);
                      onCommit();
                    }
                  }}
                  className="rounded-md border border-border-base bg-bg-elevated px-2 text-xs text-fg-base hover:bg-bg-hover"
                >
                  Pick…
                </button>
              </div>
            </Field>
          )}
          <Field label="Object fit" hint="How the image scales inside the box">
            <select
              value={element.objectFit}
              onChange={(e) => {
                onPatch({
                  objectFit: e.target.value as 'contain' | 'cover' | 'fill',
                } as Partial<TemplateElement>);
                onCommit();
              }}
              className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
            >
              <option value="contain">Contain (no crop)</option>
              <option value="cover">Cover (crop to fill)</option>
              <option value="fill">Fill (stretch)</option>
            </select>
          </Field>
        </>
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

// ── Logo element properties ────────────────────────────────────────────────

function LogoFields({
  element,
  onPatch,
  onCommit,
}: {
  element: Extract<TemplateElement, { type: 'logo' }>;
  onPatch: (p: Partial<TemplateElement>) => void;
  onCommit: () => void;
}) {
  const template = useDesignerStore((s) => s.template);
  const brand = useBrandStore((s) =>
    template ? (s.brands.find((b) => b.id === template.brandId) ?? null) : null,
  );

  const logos = brand?.logos ?? [];
  const effectiveId =
    element.logoId && logos.find((l) => l.id === element.logoId)
      ? element.logoId
      : (logos[0]?.id ?? '');

  return (
    <>
      <Field
        label="Which logo"
        hint={
          logos.length === 0
            ? 'This brand has no logo files yet — add some on the brand edit page.'
            : 'Pick which of this brand’s logo variants to display here.'
        }
      >
        <select
          value={effectiveId}
          disabled={logos.length === 0}
          onChange={(e) => {
            const id = e.target.value;
            // When the user picks the brand's first logo (the default), store
            // undefined so future changes to the brand's primary still flow
            // through. Otherwise store the explicit id.
            onPatch({
              logoId: id && id !== logos[0]?.id ? id : undefined,
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          {logos.length === 0 && <option value="">— no logos —</option>}
          {logos.map((l, i) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {i === 0 ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Object fit" hint="How the logo scales inside its box">
        <select
          value={element.objectFit}
          onChange={(e) => {
            onPatch({
              objectFit: e.target.value as 'contain' | 'cover' | 'fill',
            } as Partial<TemplateElement>);
            onCommit();
          }}
          className="w-full rounded-md border border-border-base bg-bg-surface px-2 py-1.5 text-sm"
        >
          <option value="contain">Contain (no crop)</option>
          <option value="cover">Cover (crop to fill)</option>
          <option value="fill">Fill (stretch)</option>
        </select>
      </Field>
    </>
  );
}
