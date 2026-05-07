import { useState, type DragEvent } from 'react';
import {
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconChevronUp,
  IconChevronDown,
  IconChevronRight,
  IconFolder,
} from '@tabler/icons-react';
import { useDesignerStore } from '../stores/designerStore';
import type { TemplateElement } from '../../shared/types/template';

// 1×1 transparent GIF used to suppress the default drag ghost. Browsers won't
// honour `setDragImage` with a fresh `new Image()` whose src is set in the
// same tick, so a pre-decoded data URL is the reliable workaround.
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const dragGhost = typeof Image !== 'undefined' ? new Image() : null;
if (dragGhost) dragGhost.src = TRANSPARENT_PIXEL;

export function Layers() {
  const template = useDesignerStore((s) => s.template);
  const selectedIds = useDesignerStore((s) => s.selectedIds);
  const select = useDesignerStore((s) => s.select);
  const updateElement = useDesignerStore((s) => s.updateElement);
  const reorderElement = useDesignerStore((s) => s.reorderElement);
  const reorderLayer = useDesignerStore((s) => s.reorderLayer);
  const pushHistory = useDesignerStore((s) => s.pushHistory);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  if (!template) return null;

  // Top-most first in the list (highest zIndex first).
  const sorted = [...template.elements].sort((a, b) => b.zIndex - a.zIndex);

  // Pre-walk the list to know where each group starts and how many members
  // it has. We render a header row right before the group's first appearance
  // and indent every member underneath it. This relies on group members
  // being contiguous in z-order — they may not be, but for the common
  // workflow (group elements that were just multi-selected) they typically
  // are. Non-contiguous members just get separate "subgroups" in the list,
  // which is reasonable visual feedback that the group spans z-layers.
  const groupCounts = new Map<string, number>();
  for (const el of sorted) {
    if (el.groupId) {
      groupCounts.set(el.groupId, (groupCounts.get(el.groupId) ?? 0) + 1);
    }
  }
  const seenGroups = new Set<string>();

  // A drop at the dragged row's own slot (or the slot directly below it) is a
  // no-op — suppress the indicator in those cases so the user gets honest
  // feedback about what releasing will do.
  const isNoOp =
    dragIndex !== null &&
    dropIndex !== null &&
    (dropIndex === dragIndex || dropIndex === dragIndex + 1);

  const finishDrag = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

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
        <ul
          className="scrollbar-thin flex-1 overflow-y-auto"
          onDragLeave={(e) => {
            // Clear the indicator only when the cursor leaves the list itself,
            // not when it transitions between child rows.
            if (e.currentTarget === e.target) setDropIndex(null);
          }}
        >
          {sorted.map((el, i) => {
            const rows: React.ReactNode[] = [];
            if (el.groupId && !seenGroups.has(el.groupId)) {
              seenGroups.add(el.groupId);
              const gid = el.groupId;
              const count = groupCounts.get(gid) ?? 1;
              const isCollapsed = collapsed.has(gid);
              const groupSelected = sorted.some(
                (g) => g.groupId === gid && selectedIds.includes(g.id),
              );
              rows.push(
                <GroupHeaderRow
                  key={`group-${gid}`}
                  count={count}
                  collapsed={isCollapsed}
                  selected={groupSelected}
                  onSelect={() => {
                    // Click on the group header selects every member (the
                    // store expands group selection automatically anyway,
                    // but pass the first id explicitly for clarity).
                    const first = sorted.find((g) => g.groupId === gid);
                    if (first) select([first.id]);
                  }}
                  onToggleCollapsed={() => {
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(gid)) next.delete(gid);
                      else next.add(gid);
                      return next;
                    });
                  }}
                />,
              );
            }
            const hidden = el.groupId && collapsed.has(el.groupId);
            if (!hidden) {
              rows.push(
                <LayerRow
                  key={el.id}
                  element={el}
                  index={i}
                  selected={selectedIds.includes(el.id)}
                  indented={!!el.groupId}
                  dragging={dragIndex === i}
                  showIndicatorAbove={!isNoOp && dropIndex === i}
                  showIndicatorBelow={
                    !isNoOp && i === sorted.length - 1 && dropIndex === sorted.length
                  }
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
                  onDragStart={(e) => {
                    setDragIndex(i);
                    e.dataTransfer.effectAllowed = 'move';
                    // Required for the drop event to fire in Firefox.
                    e.dataTransfer.setData('text/plain', el.id);
                    if (dragGhost) e.dataTransfer.setDragImage(dragGhost, 0, 0);
                  }}
                  onDragOver={(e) => {
                    if (dragIndex === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const rect = e.currentTarget.getBoundingClientRect();
                    const inTopHalf = e.clientY - rect.top < rect.height / 2;
                    setDropIndex(inTopHalf ? i : i + 1);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null && dropIndex !== null) {
                      reorderLayer(dragIndex, dropIndex);
                    }
                    finishDrag();
                  }}
                  onDragEnd={finishDrag}
                />,
              );
            }
            return rows;
          })}
        </ul>
      )}
    </div>
  );
}

function GroupHeaderRow({
  count,
  collapsed,
  selected,
  onSelect,
  onToggleCollapsed,
}: {
  count: number;
  collapsed: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <li
      onClick={onSelect}
      className={[
        'flex items-center gap-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wide',
        selected
          ? 'bg-accent/10 text-fg-base'
          : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
        'cursor-pointer',
      ].join(' ')}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapsed();
        }}
        className="rounded p-0.5 hover:bg-bg-hover"
        title={collapsed ? 'Expand group' : 'Collapse group'}
      >
        {collapsed ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
      </button>
      <IconFolder size={12} />
      <span className="flex-1 truncate">Group ({count} items)</span>
    </li>
  );
}

function LayerRow({
  element,
  selected,
  indented,
  dragging,
  showIndicatorAbove,
  showIndicatorBelow,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  element: TemplateElement;
  index: number;
  selected: boolean;
  indented: boolean;
  dragging: boolean;
  showIndicatorAbove: boolean;
  showIndicatorBelow: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (e: DragEvent<HTMLLIElement>) => void;
  onDragOver: (e: DragEvent<HTMLLIElement>) => void;
  onDrop: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd: (e: DragEvent<HTMLLIElement>) => void;
}) {
  return (
    <li
      draggable
      onClick={onSelect}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={[
        'relative flex items-center gap-1 py-1.5 text-xs',
        indented ? 'pl-6 pr-3' : 'px-3',
        selected
          ? 'bg-accent/10 text-fg-base'
          : 'text-fg-muted hover:bg-bg-hover hover:text-fg-base',
        dragging ? 'opacity-40' : '',
        'cursor-pointer',
      ].join(' ')}
    >
      {showIndicatorAbove && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-accent" />
      )}
      {showIndicatorBelow && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
      )}
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
