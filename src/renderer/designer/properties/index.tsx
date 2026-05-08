import { useDesignerStore } from '../../stores/designerStore';
import {
  defaultAspectLock,
  isAspectLocked,
  type TemplateElement,
} from '../../../shared/types/template';
import { IconTrash, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { Button } from '../../components/Button';
import { Field, ColorInput } from '../../components/FormField';
import { NumberInput } from './shared';
import { TextProperties } from './text';
import { PriceProperties } from './price';
import { CountryProperties } from './country';
import { ColorbarProperties } from './colorbar';
import { RectProperties } from './rect';
import { QRProperties } from './qr';
import { BarcodeProperties } from './barcode';
import { LogoProperties } from './logo';
import { DateProperties } from './date';
import { ImageProperties } from './image';

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
    case 'sku':
      return <TextProperties element={element} onPatch={onPatch} onCommit={onCommit} />;
    case 'price':
      return <PriceProperties element={element} onPatch={onPatch} onCommit={onCommit} />;
    case 'country':
      return <CountryProperties element={element} onPatch={onPatch} onCommit={onCommit} />;
    case 'colorbar':
      return <ColorbarProperties element={element} onPatch={onPatch} onCommit={onCommit} />;
    case 'rect':
      return <RectProperties element={element} onPatch={onPatch} onCommit={onCommit} />;
    case 'qr':
      return <QRProperties element={element} onPatch={onPatch} onCommit={onCommit} />;
    case 'barcode':
      return <BarcodeProperties element={element} onPatch={onPatch} onCommit={onCommit} />;
    case 'logo':
      return <LogoProperties element={element} onPatch={onPatch} onCommit={onCommit} />;
    case 'date':
      return <DateProperties element={element} onPatch={onPatch} onCommit={onCommit} />;
    case 'image':
      return <ImageProperties element={element} onPatch={onPatch} onCommit={onCommit} />;
    default:
      return null;
  }
}
