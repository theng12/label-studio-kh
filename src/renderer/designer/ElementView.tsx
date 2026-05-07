import type { TemplateElement } from '../../shared/types/template';
import { flagFromCode, formatPrice } from '../../shared/format';

// Placeholder visuals for the designer canvas. Real barcode/QR/font rendering
// happens in Phase 2's Puppeteer export; the designer just needs something
// that looks roughly right so layout decisions are meaningful.
export function ElementView({ element }: { element: TemplateElement }) {
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };

  switch (element.type) {
    case 'logo':
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

    case 'barcode': {
      // Simple striped placeholder
      const bars = Array.from({ length: 24 }, (_, i) => i);
      return (
        <div style={{ ...style, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'stretch',
              gap: 1,
              padding: '1px 0',
              background: 'white',
            }}
          >
            {bars.map((b) => (
              <div
                key={b}
                style={{
                  flex: b % 3 === 0 ? '0 0 2px' : '0 0 1px',
                  background: element.barColor || '#000',
                }}
              />
            ))}
          </div>
          {element.showHumanReadable && (
            <div
              style={{
                fontSize: 6,
                textAlign: 'center',
                fontFamily: 'monospace',
                color: '#000',
              }}
            >
              {element.csvColumn || element.manualValue || '0000000000000'}
            </div>
          )}
        </div>
      );
    }

    case 'qr':
      // 8x8 placeholder grid
      return (
        <div
          style={{
            ...style,
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 0,
            background: 'white',
          }}
        >
          {Array.from({ length: 64 }, (_, i) => {
            const isFinder =
              (i < 16 && i % 8 < 2) ||
              (i < 16 && i % 8 >= 6) ||
              (i >= 48 && i % 8 < 2) ||
              ((i + 7) % 13 === 0);
            return (
              <div key={i} style={{ background: isFinder ? '#000' : 'transparent' }} />
            );
          })}
        </div>
      );

    case 'sku':
    case 'text': {
      const text =
        element.dataSource === 'static'
          ? element.staticText
          : `{${element.csvColumn || 'column'}}`;
      const multiline = element.type === 'text' && element.multiline === true;
      const verticalAlign = element.verticalAlign ?? 'top';
      return (
        <div
          style={{
            ...style,
            color: element.color,
            fontSize: element.fontSize,
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
                fontSize: element.fontSize * 0.65,
                textDecoration: 'line-through',
                fontWeight: 'normal',
              }}
            >
              {strike}
            </span>
          )}
          <span style={{ fontSize: element.fontSize }}>{main}</span>
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
            fontSize: element.fontSize,
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
            fontSize: element.fontSize,
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
      return (
        <div
          style={{
            ...style,
            color: element.color,
            fontSize: element.fontSize,
            fontFamily: element.fontFamily,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {element.labelText && <span>{element.labelText}</span>}
          {element.showDottedLine ? (
            <span
              style={{
                flex: 1,
                borderBottom: '1px dotted #888',
                height: '50%',
              }}
            />
          ) : (
            <span>
              {element.mode === 'today'
                ? new Date().toLocaleDateString()
                : element.mode === 'static'
                  ? element.staticDate
                  : `{${element.csvColumn}}`}
            </span>
          )}
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
