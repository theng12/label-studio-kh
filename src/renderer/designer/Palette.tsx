import {
  IconBrandAbstract,
  IconBarcode,
  IconQrcode,
  IconHash,
  IconLetterT,
  IconPhoto,
  IconLayoutBottombar,
  IconBorderHorizontal,
  IconRosette,
  IconSeparator,
  IconCalendar,
  IconSquare,
  type Icon,
} from '@tabler/icons-react';
import type { ElementType } from '../../shared/types/template';
import { useDesignerStore } from '../stores/designerStore';

const ITEMS: { type: ElementType; label: string; icon: Icon }[] = [
  { type: 'logo', label: 'Logo', icon: IconBrandAbstract },
  { type: 'barcode', label: 'Barcode', icon: IconBarcode },
  { type: 'qr', label: 'QR code', icon: IconQrcode },
  { type: 'sku', label: 'SKU', icon: IconHash },
  { type: 'text', label: 'Text', icon: IconLetterT },
  { type: 'image', label: 'Image', icon: IconPhoto },
  { type: 'colorbar', label: 'Color bar', icon: IconLayoutBottombar },
  { type: 'strip', label: 'Strip box', icon: IconBorderHorizontal },
  { type: 'cert', label: 'Cert badge', icon: IconRosette },
  { type: 'divider', label: 'Divider', icon: IconSeparator },
  { type: 'date', label: 'Date', icon: IconCalendar },
  { type: 'rect', label: 'Rectangle', icon: IconSquare },
];

export function Palette() {
  const addElement = useDesignerStore((s) => s.addElement);
  const template = useDesignerStore((s) => s.template);

  return (
    <div className="border-b border-border-subtle p-2">
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
        Elements
      </div>
      <div className="grid grid-cols-2 gap-1">
        {ITEMS.map((item) => (
          <button
            key={item.type}
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData('application/x-lskh-element', item.type)
            }
            onDoubleClick={() => {
              if (!template) return;
              // place near top-left when added by double-click
              addElement(item.type, 5, 5);
            }}
            className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-2 py-2 text-xs text-fg-base transition-colors hover:bg-bg-hover"
            title={`Drag onto canvas, or double-click to place`}
          >
            <item.icon size={16} stroke={1.75} />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 px-2 text-[10px] text-fg-subtle">
        Drag onto canvas, or double-click to add at the top-left.
      </div>
    </div>
  );
}
