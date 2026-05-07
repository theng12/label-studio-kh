import type { TemplateElement, BrandField } from '../../shared/types/template';
import type { Brand } from '../../shared/types/brand';
import {
  CSS_PX_PER_MM,
  flagFromCode,
  formatDate,
  formatPrice,
  parseDateLoose,
  ptToPx,
} from '../../shared/format';
import { BarcodeView } from './BarcodeView';
import { QRView } from './QRView';

function localFileUrl(path: string): string {
  const segments = path.split('/').map(encodeURIComponent).join('/');
  return `lskh-file://${segments}`;
}

function brandFieldValue(brand: Brand | null | undefined, field: BrandField | undefined): string {
  if (!brand) return '';
  switch (field ?? 'address') {
    case 'address':
      return brand.address ?? '';
    case 'phone':
      return brand.phone ?? '';
    case 'email':
      return brand.email ?? '';
    case 'website':
      return brand.website ?? '';
    case 'tagline':
      return brand.tagline ?? '';
    case 'customerCareLabel':
      return brand.customerCareLabel ?? '';
  }
}

function resolveLogoPath(
  element: { logoId?: string; type: 'logo' },
  brand: Brand | null | undefined,
): string | null {
  if (!brand) return null;
  const logos = brand.logos ?? [];
  if (element.logoId) {
    const found = logos.find((l) => l.id === element.logoId);
    if (found) return found.path;
  }
  return logos[0]?.path ?? brand.logoPath ?? null;
}

// Placeholder visuals for the designer canvas. Real barcode/QR/font rendering
// happens in Puppeteer export; the designer just needs something that looks
// roughly right so layout decisions are meaningful. The Logo element is the
// exception: when a brand provides a real logo file, we show it directly so
// the user sees the actual asset while designing.
//
// Font sizes are stored in points (a physical unit). To stay proportionate
// across zoom, we convert pt → px using the caller's current pxPerMm. When
// the caller doesn't pass one (e.g. a static review thumbnail) we fall back
// to the 1:1 physical 96-DPI ratio so output still matches print.
export function ElementView({
  element,
  brand,
  pxPerMm = CSS_PX_PER_MM,
}: {
  element: TemplateElement;
  brand?: Brand | null;
  pxPerMm?: number;
}) {
  const fontPx = (pt: number) => ptToPx(pt, pxPerMm);
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };

  switch (element.type) {
    case 'logo': {
      const path = resolveLogoPath(element, brand);
      if (path) {
        return (
          <div
            style={{
              ...style,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={localFileUrl(path)}
              alt="logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: element.objectFit,
              }}
            />
          </div>
        );
      }
      return (
        <div
          style={{
            ...style,
            background:
              'repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 4px, transparent 4px 8px)',
            border: '1px dashed rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0,0,0,0.5)',
            fontSize: 9,
            fontWeight: 600,
          }}
        >
          LOGO
        </div>
      );
    }

    case 'barcode': {
      // Live JsBarcode render. Uses manualValue when set, otherwise a sample
      // for the chosen format so the user can still see the bar shapes when
      // the value is bound to a CSV column.
      const value =
        element.dataSource === 'manual' ? element.manualValue : '';
      return (
        <div style={{ ...style, background: 'white' }}>
          <BarcodeView
            value={value}
            format={element.format}
            showText={element.showHumanReadable}
            barColor={element.barColor}
          />
        </div>
      );
    }

    case 'qr': {
      // Live qrcode.js render. The mode dictates which value we can preview:
      // static → show the static URL; everything else → fall back to a
      // sample URL since per-row data isn't known in the designer.
      const value =
        element.mode === 'static' ? element.staticUrl : '';
      return (
        <div
          style={{
            ...style,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
            <QRView value={value} errorCorrection={element.errorCorrection} />
          </div>
          {element.showUrlText && (
            <div
              style={{
                fontSize: 5,
                lineHeight: 1,
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
              }}
            >
              {value || '{url}'}
            </div>
          )}
        </div>
      );
    }

    case 'sku':
    case 'text': {
      let text: string;
      if (element.dataSource === 'static') {
        text = element.staticText;
      } else if (element.dataSource === 'brand_field') {
        // Show the live brand value when we have a brand; otherwise show a
        // helpful placeholder so the box isn't blank in the designer.
        const v = brandFieldValue(brand, element.brandField);
        text = v || `{brand.${element.brandField ?? 'address'}}`;
      } else {
        text = `{${element.csvColumn || 'column'}}`;
      }
      const multiline = element.type === 'text' && element.multiline === true;
      const verticalAlign = element.verticalAlign ?? 'top';
      return (
        <div
          style={{
            ...style,
            color: element.color,
            fontSize: fontPx(element.fontSize),
            fontWeight: element.fontWeight,
            fontFamily: element.fontFamily,
            textAlign: element.align,
            display: 'flex',
            alignItems: multiline
              ? verticalAlign === 'center'
                ? 'center'
                : verticalAlign === 'bottom'
                  ? 'flex-end'
                  : 'flex-start'
              : 'center',
            justifyContent:
              element.align === 'center'
                ? 'center'
                : element.align === 'right'
                  ? 'flex-end'
                  : 'flex-start',
            whiteSpace: multiline ? 'normal' : 'nowrap',
            overflow: 'hidden',
            textOverflow: multiline ? 'clip' : 'ellipsis',
            lineHeight: multiline ? (element.lineHeight ?? 1.2) : 1,
            wordBreak: multiline ? 'break-word' : 'normal',
          }}
        >
          {text}
        </div>
      );
    }

    case 'price': {
      const fmt = {
        currency: element.currency,
        currencyPosition: element.currencyPosition,
        thousandsSeparator: element.thousandsSeparator,
        decimalSeparator: element.decimalSeparator,
        decimals: element.decimals,
      };
      const sample =
        element.amountSource === 'static' ? element.amountStatic : '9.99';
      const sampleSale =
        element.salePriceSource === 'none'
          ? null
          : element.salePriceSource === 'static'
            ? element.salePriceStatic
            : '7.99';
      const main = formatPrice(sampleSale ?? sample, fmt);
      const strike = sampleSale ? formatPrice(sample, fmt) : null;
      const justify =
        element.align === 'center'
          ? 'center'
          : element.align === 'right'
            ? 'flex-end'
            : 'flex-start';
      return (
        <div
          style={{
            ...style,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: justify,
            gap: '0.4em',
            color: element.color,
            fontFamily: element.fontFamily,
            fontWeight: element.fontWeight,
          }}
        >
          {strike && (
            <span
              style={{
                color: element.saleColor,
                fontSize: fontPx(element.fontSize * 0.65),
                textDecoration: 'line-through',
                fontWeight: 'normal',
              }}
            >
              {strike}
            </span>
          )}
          <span style={{ fontSize: fontPx(element.fontSize) }}>{main}</span>
        </div>
      );
    }

    case 'country': {
      const name =
        element.source === 'static'
          ? element.staticCountry
          : `{${element.csvColumn || 'country'}}`;
      const flag = element.showFlag ? flagFromCode(element.countryCode) : '';
      const code = element.showCode ? element.countryCode.toUpperCase() : '';
      const parts = [
        element.prefix,
        flag,
        element.showName ? name : '',
        code,
      ].filter(Boolean);
      const justify =
        element.align === 'center'
          ? 'center'
          : element.align === 'right'
            ? 'flex-end'
            : 'flex-start';
      return (
        <div
          style={{
            ...style,
            display: 'flex',
            alignItems: 'center',
            justifyContent: justify,
            gap: '0.3em',
            color: element.color,
            fontSize: fontPx(element.fontSize),
            fontFamily: element.fontFamily,
            whiteSpace: 'nowrap',
          }}
        >
          {parts.join(' ')}
        </div>
      );
    }

    case 'image':
      return (
        <div
          style={{
            ...style,
            background:
              'repeating-linear-gradient(135deg, rgba(0,0,0,0.04) 0 4px, transparent 4px 8px)',
            border: '1px dashed rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0,0,0,0.4)',
            fontSize: 9,
          }}
        >
          IMG
        </div>
      );

    case 'colorbar':
      return <div style={{ ...style, background: element.color }} />;

    case 'strip':
      return (
        <div
          style={{
            ...style,
            border: `0.5px solid ${element.borderColor}`,
            background: element.fillColor,
            color: element.textColor,
            fontSize: fontPx(element.fontSize),
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              element.textAlign === 'center'
                ? 'center'
                : element.textAlign === 'right'
                  ? 'flex-end'
                  : 'flex-start',
            padding: '0 4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {element.staticText || `{${element.csvColumn}}`}
        </div>
      );

    case 'cert':
      return (
        <div
          style={{
            ...style,
            border: '1px dashed rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0,0,0,0.5)',
            fontSize: 8,
          }}
        >
          CERT
        </div>
      );

    case 'divider':
      return (
        <div
          style={{
            ...style,
            background: element.color,
          }}
        />
      );

    case 'date': {
      let text = '';
      if (element.mode === 'today') {
        text = formatDate(new Date(), element.formatStyle, element.format);
      } else if (element.mode === 'static') {
        const d = parseDateLoose(element.staticDate);
        text = Number.isFinite(d.getTime())
          ? formatDate(d, element.formatStyle, element.format)
          : element.staticDate || '—';
      } else {
        // CSV column — no live row in the designer, show a hint placeholder.
        text = `{${element.csvColumn || 'date'}}`;
      }
      const justify =
        element.align === 'center'
          ? 'center'
          : element.align === 'right'
            ? 'flex-end'
            : 'flex-start';
      return (
        <div
          style={{
            ...style,
            color: element.color,
            fontSize: fontPx(element.fontSize),
            fontFamily: element.fontFamily,
            fontWeight: element.fontWeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: justify,
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </div>
      );
    }

    case 'rect':
      return (
        <div
          style={{
            ...style,
            background: element.fillColor,
            border: `${element.borderWidth_mm * 4}px solid ${element.borderColor}`,
            borderRadius: element.cornerRadius_mm * 4,
          }}
        />
      );
  }
}
