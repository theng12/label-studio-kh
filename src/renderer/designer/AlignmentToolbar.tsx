import {
  IconLayoutAlignLeft,
  IconLayoutAlignCenter,
  IconLayoutAlignRight,
  IconLayoutAlignTop,
  IconLayoutAlignMiddle,
  IconLayoutAlignBottom,
  IconLayoutDistributeHorizontal,
  IconLayoutDistributeVertical,
} from '@tabler/icons-react';
import { useDesignerStore, type AlignMode, type DistributeAxis } from '../stores/designerStore';

interface BtnProps {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function Btn({ onClick, title, disabled, children }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg-base disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/**
 * Floating toolbar for arranging multi-selected elements. Shown above the
 * canvas only when ≥2 elements are selected. Distribute buttons need ≥3.
 */
export function AlignmentToolbar() {
  const selectedIds = useDesignerStore((s) => s.selectedIds);
  const alignSelected = useDesignerStore((s) => s.alignSelected);
  const distributeSelected = useDesignerStore((s) => s.distributeSelected);

  if (selectedIds.length < 2) return null;
  const canDistribute = selectedIds.length >= 3;

  const align = (mode: AlignMode) => () => alignSelected(mode);
  const distribute = (axis: DistributeAxis) => () => distributeSelected(axis);

  return (
    <div
      role="toolbar"
      aria-label="Alignment"
      className="pointer-events-auto absolute left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border-base bg-bg-surface px-1 py-1 shadow-lg"
    >
      <Btn onClick={align('left')} title="Align left edges">
        <IconLayoutAlignLeft size={16} />
      </Btn>
      <Btn onClick={align('center')} title="Align horizontal centers">
        <IconLayoutAlignCenter size={16} />
      </Btn>
      <Btn onClick={align('right')} title="Align right edges">
        <IconLayoutAlignRight size={16} />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border-base" />
      <Btn onClick={align('top')} title="Align top edges">
        <IconLayoutAlignTop size={16} />
      </Btn>
      <Btn onClick={align('middle')} title="Align vertical centers">
        <IconLayoutAlignMiddle size={16} />
      </Btn>
      <Btn onClick={align('bottom')} title="Align bottom edges">
        <IconLayoutAlignBottom size={16} />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border-base" />
      <Btn
        onClick={distribute('horizontal')}
        title={canDistribute ? 'Distribute horizontally' : 'Select 3+ elements to distribute'}
        disabled={!canDistribute}
      >
        <IconLayoutDistributeHorizontal size={16} />
      </Btn>
      <Btn
        onClick={distribute('vertical')}
        title={canDistribute ? 'Distribute vertically' : 'Select 3+ elements to distribute'}
        disabled={!canDistribute}
      >
        <IconLayoutDistributeVertical size={16} />
      </Btn>
    </div>
  );
}
