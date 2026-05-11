import {
  IconBrandAbstract,
  IconBarcode,
  IconQrcode,
  IconHash,
  IconLetterT,
  IconPhoto,
  IconLayoutBottombar,
  IconRosette,
  IconSeparator,
  IconCalendar,
  IconSquare,
  IconCurrencyDollar,
  IconWorld,
  IconAddressBook,
  type Icon,
} from '@tabler/icons-react';
import type {
  ElementType,
  TemplateElement,
} from '../../shared/types/template';
import { useDesignerStore } from '../stores/designerStore';

interface PaletteItem {
  key: string;
  label: string;
  icon: Icon;
  type: ElementType;
  /** Optional overrides applied on top of the type's defaults. */
  overrides?: Partial<TemplateElement>;
}

const ITEMS: PaletteItem[] = [
  { key: 'logo', type: 'logo', label: 'Logo', icon: IconBrandAbstract },
  { key: 'barcode', type: 'barcode', label: 'Barcode', icon: IconBarcode },
  { key: 'qr', type: 'qr', label: 'QR code', icon: IconQrcode },
  { key: 'sku', type: 'sku', label: 'SKU', icon: IconHash },
  { key: 'text', type: 'text', label: 'Text', icon: IconLetterT },
  { key: 'price', type: 'price', label: 'Price', icon: IconCurrencyDollar },
  {
    // 'Brand info' = a Text element pre-bound to the brand's address. Users
    // can switch to phone / email / website / tagline / customer-care via the
    // properties panel. Multiline by default since addresses usually wrap.
    key: 'brandinfo',
    type: 'text',
    label: 'Brand info',
    icon: IconAddressBook,
    overrides: {
      dataSource: 'brand_field',
      brandField: 'address',
      width_mm: 50,
      height_mm: 14,
      multiline: true,
      lineHeight: 1.2,
      verticalAlign: 'top',
      fontSize: 7,
      name: 'Brand info',
    } as Partial<TemplateElement>,
  },
  { key: 'image', type: 'image', label: 'Image', icon: IconPhoto },
  { key: 'colorbar', type: 'colorbar', label: 'Color bar', icon: IconLayoutBottombar },
  // 'Strip box' was removed from the palette — it was a hardcoded
  // '1 UNIT OF {product_name}' label with no edit UI. A Text element gets
  // the same effect with full editing: pick any prefix, any CSV column to
  // substitute via {column} placeholder, plus font / color / multiline.
  // Existing strip elements in saved templates still load and render via
  // the strip case in ElementView.tsx and StickerRenderer.ts.
  { key: 'cert', type: 'cert', label: 'Cert badge', icon: IconRosette },
  { key: 'divider', type: 'divider', label: 'Divider', icon: IconSeparator },
  { key: 'date', type: 'date', label: 'Date', icon: IconCalendar },
  { key: 'country', type: 'country', label: 'Origin', icon: IconWorld },
  { key: 'rect', type: 'rect', label: 'Rectangle', icon: IconSquare },
];

const MIME = 'application/x-lskh-element';

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
            key={item.key}
            draggable
            onDragStart={(e) => {
              // Ship the whole spec so Canvas can apply overrides for items
              // like 'Brand info' that are presets on top of a base type.
              e.dataTransfer.setData(
                MIME,
                JSON.stringify({ type: item.type, overrides: item.overrides ?? null }),
              );
            }}
            onDoubleClick={() => {
              if (!template) return;
              addElement(item.type, 5, 5, item.overrides);
            }}
            className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-2 py-2 text-xs text-fg-base transition-colors hover:bg-bg-hover"
            title="Drag onto canvas, or double-click to place"
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

export const PALETTE_MIME = MIME;
