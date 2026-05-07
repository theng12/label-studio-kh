import { useEffect, useRef, useState } from 'react';
import {
  IconDeviceFloppy,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconTrash,
  IconAspectRatio,
  IconChevronDown,
} from '@tabler/icons-react';
import { useDesignerStore } from '../stores/designerStore';
import { Button } from '../components/Button';
import { useBrandStore } from '../stores/brandStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SIZE_PRESETS, PX_PER_MM } from '../../shared/sizePresets';

interface Props {
  onSave: () => void;
  saving: boolean;
}

type Unit = 'mm' | 'px';

const UNIT_KEY = 'lskh.designer.unit';

export function TopBar({ onSave, saving }: Props) {
  const template = useDesignerStore((s) => s.template);
  const patchTemplate = useDesignerStore((s) => s.patchTemplate);
  const setDimensions = useDesignerStore((s) => s.setDimensions);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const canUndo = useDesignerStore((s) => s.canUndo);
  const canRedo = useDesignerStore((s) => s.canRedo);
  const clearAllElements = useDesignerStore((s) => s.clearAllElements);
  const brands = useBrandStore((s) => s.brands);

  const [confirmClear, setConfirmClear] = useState(false);
  const [unit, setUnitState] = useState<Unit>(
    () => (typeof localStorage !== 'undefined' && (localStorage.getItem(UNIT_KEY) as Unit)) || 'mm',
  );
  const setUnit = (u: Unit) => {
    setUnitState(u);
    localStorage.setItem(UNIT_KEY, u);
  };

  if (!template) return null;
  const brand = brands.find((b) => b.id === template.brandId);
  const hasElements = template.elements.length > 0;

  return (
    <header className="drag-region flex h-12 items-center justify-between border-b border-border-base bg-bg-surface px-3">
      <div className="no-drag flex items-center gap-2">
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

        <NumberPill
          label="W"
          value={template.width_mm}
          unit={unit}
          onChange={(mm) => setDimensions(mm, template.height_mm)}
        />
        <NumberPill
          label="H"
          value={template.height_mm}
          unit={unit}
          onChange={(mm) => setDimensions(template.width_mm, mm)}
        />
        <UnitToggle value={unit} onChange={setUnit} />
        <PresetsButton
          onPick={(w, h) => setDimensions(w, h)}
          currentW={template.width_mm}
          currentH={template.height_mm}
        />
      </div>

      <div className="no-drag flex items-center gap-1.5">
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
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmClear(true)}
          disabled={!hasElements}
          title="Remove all elements from this template"
        >
          <IconTrash size={14} /> Clear all
        </Button>
        <Button size="sm" variant="primary" onClick={onSave} disabled={saving}>
          <IconDeviceFloppy size={14} /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all elements?"
        message={
          <>
            This will remove <strong>{template.elements.length}</strong> element
            {template.elements.length === 1 ? '' : 's'} from{' '}
            <strong>{template.name}</strong>. The template itself stays — only its
            contents are cleared.
            <br />
            <br />
            You can undo this with <kbd>⌘Z</kbd>, but the change won't be saved to
            disk until you click <strong>Save</strong>.
          </>
        }
        confirmLabel="Clear all"
        cancelLabel="Keep elements"
        tone="danger"
        onConfirm={() => {
          clearAllElements();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </header>
  );
}

// ── Width / height pill that switches between mm and px display ─────────────

function NumberPill({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number; // mm
  unit: Unit;
  onChange: (mm: number) => void;
}) {
  // The input shows the current value in the user's chosen unit. When they
  // type, we convert back to mm before propagating so the underlying template
  // stays mm-canonical.
  const displayed =
    unit === 'mm'
      ? Math.round(value * 10) / 10
      : Math.round(value * PX_PER_MM);

  return (
    <label className="flex items-center gap-1 rounded-md border border-border-base bg-bg-base px-1.5 py-0.5 text-xs text-fg-muted">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        step={unit === 'mm' ? 1 : 5}
        value={displayed}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v) && v > 0) {
            const mm = unit === 'mm' ? v : v / PX_PER_MM;
            onChange(Math.round(mm * 10) / 10);
          }
        }}
        className="w-14 bg-transparent text-fg-base focus:outline-none"
      />
      <span className="text-fg-subtle">{unit}</span>
    </label>
  );
}

function UnitToggle({
  value,
  onChange,
}: {
  value: Unit;
  onChange: (u: Unit) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border-base bg-bg-base p-0.5 text-[10px]">
      {(['mm', 'px'] as Unit[]).map((u) => (
        <button
          key={u}
          onClick={() => onChange(u)}
          className={[
            'px-1.5 py-0.5 rounded-sm font-medium transition-colors',
            value === u
              ? 'bg-accent text-accent-fg'
              : 'text-fg-muted hover:text-fg-base',
          ].join(' ')}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

// ── Size presets dropdown ───────────────────────────────────────────────────

function PresetsButton({
  onPick,
  currentW,
  currentH,
}: {
  onPick: (width_mm: number, height_mm: number) => void;
  currentW: number;
  currentH: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md border border-border-base bg-bg-base px-2 py-1 text-xs text-fg-muted hover:bg-bg-hover hover:text-fg-base"
        title="Pick a size preset"
      >
        <IconAspectRatio size={12} />
        Presets
        <IconChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-md border border-border-base bg-bg-surface p-1 shadow-xl">
          <div className="scrollbar-thin max-h-[480px] overflow-y-auto">
            {SIZE_PRESETS.map((group) => (
              <div key={group.group}>
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
                  {group.group}
                </div>
                {group.presets.map((p) => {
                  const active =
                    Math.abs(p.width_mm - currentW) < 0.05 &&
                    Math.abs(p.height_mm - currentH) < 0.05;
                  return (
                    <button
                      key={p.label}
                      onClick={() => {
                        onPick(p.width_mm, p.height_mm);
                        setOpen(false);
                      }}
                      className={[
                        'flex w-full items-start justify-between rounded px-2 py-1.5 text-left text-xs transition-colors',
                        active
                          ? 'bg-accent/10 text-fg-base'
                          : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
                      ].join(' ')}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{p.label}</span>
                        {p.description && (
                          <span className="block truncate text-[10px] text-fg-subtle">
                            {p.description}
                          </span>
                        )}
                      </span>
                      <span className="ml-2 shrink-0 font-mono text-[10px] text-fg-subtle">
                        {Math.round(p.width_mm)}×{Math.round(p.height_mm)}mm
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
