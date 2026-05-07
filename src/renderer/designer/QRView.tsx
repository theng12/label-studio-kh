import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Live QR-code preview rendered via qrcode.js (the same library the export
 * pipeline uses). Falls back to a sample URL so the designer never shows a
 * blank box, even when no data is yet bound.
 */
export function QRView({
  value,
  errorCorrection,
}: {
  value: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}) {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const v = value || 'https://example.com';
    QRCode.toString(v, {
      type: 'svg',
      errorCorrectionLevel: errorCorrection,
      margin: 0,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((s) => {
        if (cancelled) return;
        // Make the SVG fill its container.
        setSvg(
          s.replace(
            '<svg ',
            '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" ',
          ),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setSvg('');
      });
    return () => {
      cancelled = true;
    };
  }, [value, errorCorrection]);

  if (!svg) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fff',
          border: '1px dashed rgba(0,0,0,0.15)',
        }}
      />
    );
  }

  return (
    <div
      style={{ width: '100%', height: '100%' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
