import { IconDeviceFloppy, IconCopy, IconArrowBackUp, IconArrowForwardUp } from '@tabler/icons-react';
import { useDesignerStore } from '../stores/designerStore';
import { Button } from '../components/Button';
import { useBrandStore } from '../stores/brandStore';

interface Props {
  onSave: () => void;
  saving: boolean;
}

export function TopBar({ onSave, saving }: Props) {
  const template = useDesignerStore((s) => s.template);
  const patchTemplate = useDesignerStore((s) => s.patchTemplate);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const canUndo = useDesignerStore((s) => s.canUndo);
  const canRedo = useDesignerStore((s) => s.canRedo);
  const brands = useBrandStore((s) => s.brands);

  if (!template) return null;
  const brand = brands.find((b) => b.id === template.brandId);

  return (
    <header className="flex h-12 items-center justify-between border-b border-border-base bg-bg-surface px-3">
      <div className="flex items-center gap-2">
        {brand && (
          <div className="flex items-center gap-2 px-2">
            <span
              className="h-3 w-3 rounded border border-border-base"
              style={{ background: brand.color }}
            />
            <span className="text-sm font-semibold text-fg-base">{brand.name}</span>
          </div>
        )}
        <span className="mx-1 h-5 w-px bg-border-base" />
        <input
          value={template.name}
          onChange={(e) => patchTemplate({ name: e.target.value })}
          className="rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-fg-base hover:border-border-base focus:border-accent focus:bg-bg-base focus:outline-none"
        />

        <span className="mx-1 h-5 w-px bg-border-base" />

        <select
          value={template.orientation}
          onChange={(e) =>
            patchTemplate({
              orientation: e.target.value as 'portrait' | 'landscape',
            })
          }
          className="rounded-md border border-border-base bg-bg-base px-2 py-1 text-xs text-fg-base"
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>

        <NumberPill
          label="W"
          value={template.width_mm}
          onChange={(v) => patchTemplate({ width_mm: v })}
        />
        <NumberPill
          label="H"
          value={template.height_mm}
          onChange={(v) => patchTemplate({ height_mm: v })}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={!canUndo()}
          title="Undo (⌘Z)"
        >
          <IconArrowBackUp size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={redo}
          disabled={!canRedo()}
          title="Redo (⌘Y)"
        >
          <IconArrowForwardUp size={14} />
        </Button>
        <span className="mx-1 h-5 w-px bg-border-base" />
        <Button size="sm" variant="secondary" disabled title="Duplicate template (coming soon)">
          <IconCopy size={14} /> Duplicate
        </Button>
        <Button size="sm" variant="primary" onClick={onSave} disabled={saving}>
          <IconDeviceFloppy size={14} /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </header>
  );
}

function NumberPill({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 rounded-md border border-border-base bg-bg-base px-1.5 py-0.5 text-xs text-fg-muted">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        step={1}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v) && v > 0) onChange(v);
        }}
        className="w-12 bg-transparent text-fg-base focus:outline-none"
      />
      <span className="text-fg-subtle">mm</span>
    </label>
  );
}
