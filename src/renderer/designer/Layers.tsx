import {
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconChevronUp,
  IconChevronDown,
} from '@tabler/icons-react';
import { useDesignerStore } from '../stores/designerStore';
import type { TemplateElement } from '../../shared/types/template';

export function Layers() {
  const template = useDesignerStore((s) => s.template);
  const selectedIds = useDesignerStore((s) => s.selectedIds);
  const select = useDesignerStore((s) => s.select);
  const updateElement = useDesignerStore((s) => s.updateElement);
  const reorderElement = useDesignerStore((s) => s.reorderElement);
  const pushHistory = useDesignerStore((s) => s.pushHistory);

  if (!template) return null;

  // Top-most first in the list (highest zIndex first).
  const sorted = [...template.elements].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
        Layers
      </div>
      {sorted.length === 0 ? (
        <div className="px-3 py-4 text-xs text-fg-subtle">
          No elements yet. Drag from the palette above.
        </div>
      ) : (
        <ul className="scrollbar-thin flex-1 overflow-y-auto">
          {sorted.map((el) => (
            <LayerRow
              key={el.id}
              element={el}
              selected={selectedIds.includes(el.id)}
              onSelect={() => select([el.id])}
              onToggleVisible={() => {
                updateElement(el.id, { visible: !el.visible });
                pushHistory();
              }}
              onToggleLocked={() => {
                updateElement(el.id, { locked: !el.locked });
                pushHistory();
              }}
              onMoveUp={() => reorderElement(el.id, 'up')}
              onMoveDown={() => reorderElement(el.id, 'down')}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LayerRow({
  element,
  selected,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onMoveUp,
  onMoveDown,
}: {
  element: TemplateElement;
  selected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <li
      onClick={onSelect}
      className={[
        'flex items-center gap-1 px-3 py-1.5 text-xs',
        selected
          ? 'bg-accent/10 text-fg-base'
          : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
        'cursor-pointer',
      ].join(' ')}
    >
      <span className="flex-1 truncate">
        {element.name ?? element.type}
        <span className="ml-1 text-[10px] text-fg-subtle">{element.type}</span>
      </span>
      <button
        title={element.visible ? 'Hide' : 'Show'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible();
        }}
        className="rounded p-1 hover:bg-bg-hover"
      >
        {element.visible ? <IconEye size={12} /> : <IconEyeOff size={12} />}
      </button>
      <button
        title={element.locked ? 'Unlock' : 'Lock'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLocked();
        }}
        className="rounded p-1 hover:bg-bg-hover"
      >
        {element.locked ? <IconLock size={12} /> : <IconLockOpen size={12} />}
      </button>
      <button
        title="Move up"
        onClick={(e) => {
          e.stopPropagation();
          onMoveUp();
        }}
        className="rounded p-1 hover:bg-bg-hover"
      >
        <IconChevronUp size={12} />
      </button>
      <button
        title="Move down"
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown();
        }}
        className="rounded p-1 hover:bg-bg-hover"
      >
        <IconChevronDown size={12} />
      </button>
    </li>
  );
}
