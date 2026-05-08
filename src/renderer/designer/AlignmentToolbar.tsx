import {
  IconLayoutAlignLeft,
  IconLayoutAlignCenter,
  IconLayoutAlignRight,
  IconLayoutAlignTop,
  IconLayoutAlignMiddle,
  IconLayoutAlignBottom,
  IconLayoutDistributeHorizontal,
  IconLayoutDistributeVertical,
  IconAlignBoxCenterMiddle,
  IconArrowsMaximize,
  IconArrowsRightLeft,
  IconArrowsUpDown,
  IconArrowAutofitContent,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  useDesignerStore,
  type AlignMode,
  type DistributeAxis,
  type MatchSizeAxis,
} from '../stores/designerStore';

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
 * Floating toolbar for arranging the current selection. Visible whenever ≥1
 * elements are selected so the canvas-relative actions (centre, fill) are
 * always reachable. Align/distribute/match buttons disable themselves when
 * the selection is too small.
 */
export function AlignmentToolbar() {
  const { t } = useTranslation();
  const selectedIds = useDesignerStore((s) => s.selectedIds);
  const alignSelected = useDesignerStore((s) => s.alignSelected);
  const distributeSelected = useDesignerStore((s) => s.distributeSelected);
  const centerSelectionOnCanvas = useDesignerStore((s) => s.centerSelectionOnCanvas);
  const fillToCanvas = useDesignerStore((s) => s.fillToCanvas);
  const matchSize = useDesignerStore((s) => s.matchSize);

  if (selectedIds.length < 1) return null;
  const canAlign = selectedIds.length >= 2;
  const canDistribute = selectedIds.length >= 3;
  const canMatch = selectedIds.length >= 2;

  const align = (mode: AlignMode) => () => alignSelected(mode);
  const distribute = (axis: DistributeAxis) => () => distributeSelected(axis);
  const match = (axis: MatchSizeAxis) => () => matchSize(axis);

  const alignDisabledTitle = t('designer.toolbar.needTwoOrMore');
  const distributeDisabledTitle = t('designer.toolbar.needThreeOrMore');

  return (
    <div
      role="toolbar"
      aria-label={t('designer.toolbar.label')}
      className="pointer-events-auto absolute left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border-base bg-bg-surface px-1 py-1 shadow-lg"
    >
      <Btn
        onClick={centerSelectionOnCanvas}
        title={t('designer.toolbar.centerOnCanvas')}
      >
        <IconAlignBoxCenterMiddle size={16} />
      </Btn>
      <Btn onClick={fillToCanvas} title={t('designer.toolbar.fillCanvas')}>
        <IconArrowsMaximize size={16} />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border-base" />
      <Btn
        onClick={align('left')}
        title={canAlign ? t('designer.toolbar.alignLeft') : alignDisabledTitle}
        disabled={!canAlign}
      >
        <IconLayoutAlignLeft size={16} />
      </Btn>
      <Btn
        onClick={align('center')}
        title={canAlign ? t('designer.toolbar.alignCenter') : alignDisabledTitle}
        disabled={!canAlign}
      >
        <IconLayoutAlignCenter size={16} />
      </Btn>
      <Btn
        onClick={align('right')}
        title={canAlign ? t('designer.toolbar.alignRight') : alignDisabledTitle}
        disabled={!canAlign}
      >
        <IconLayoutAlignRight size={16} />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border-base" />
      <Btn
        onClick={align('top')}
        title={canAlign ? t('designer.toolbar.alignTop') : alignDisabledTitle}
        disabled={!canAlign}
      >
        <IconLayoutAlignTop size={16} />
      </Btn>
      <Btn
        onClick={align('middle')}
        title={canAlign ? t('designer.toolbar.alignMiddle') : alignDisabledTitle}
        disabled={!canAlign}
      >
        <IconLayoutAlignMiddle size={16} />
      </Btn>
      <Btn
        onClick={align('bottom')}
        title={canAlign ? t('designer.toolbar.alignBottom') : alignDisabledTitle}
        disabled={!canAlign}
      >
        <IconLayoutAlignBottom size={16} />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border-base" />
      <Btn
        onClick={distribute('horizontal')}
        title={
          canDistribute
            ? t('designer.toolbar.distributeHorizontal')
            : distributeDisabledTitle
        }
        disabled={!canDistribute}
      >
        <IconLayoutDistributeHorizontal size={16} />
      </Btn>
      <Btn
        onClick={distribute('vertical')}
        title={
          canDistribute
            ? t('designer.toolbar.distributeVertical')
            : distributeDisabledTitle
        }
        disabled={!canDistribute}
      >
        <IconLayoutDistributeVertical size={16} />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border-base" />
      <Btn
        onClick={match('width')}
        title={canMatch ? t('designer.toolbar.matchWidth') : alignDisabledTitle}
        disabled={!canMatch}
      >
        <IconArrowsRightLeft size={16} />
      </Btn>
      <Btn
        onClick={match('height')}
        title={canMatch ? t('designer.toolbar.matchHeight') : alignDisabledTitle}
        disabled={!canMatch}
      >
        <IconArrowsUpDown size={16} />
      </Btn>
      <Btn
        onClick={match('both')}
        title={canMatch ? t('designer.toolbar.matchBoth') : alignDisabledTitle}
        disabled={!canMatch}
      >
        <IconArrowAutofitContent size={16} />
      </Btn>
    </div>
  );
}
