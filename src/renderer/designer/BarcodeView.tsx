import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Live barcode preview rendered with JsBarcode straight into a real SVG
 * element. Uses the same library and options as the export pipeline so the
 * designer matches the printed output. When `value` is empty (e.g. the
 * element is bound to a CSV column and no row is selected) we fall back to
 * a sample so the user can still see the barcode shape on the canvas.
 */
export function BarcodeView({
  value,
  format,
  showText,
  barColor,
}: {
  value: string;
  format: 'EAN-13' | 'Code128' | 'Code39' | 'UPC-A';
  showText: boolean;
  barColor: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const fallback = sampleFor(format);
    const v = value || fallback;
    try {
      JsBarcode(ref.current, v, {
        format,
        displayValue: showText,
        lineColor: barColor || '#000000',
        background: '#FFFFFF',
        width: 2,
        height: 60,
        margin: 4,
        fontSize: 14,
      });
    } catch {
      // Invalid value for this format — render a soft error placeholder.
      ref.current.innerHTML = `
        <rect width="100%" height="100%" fill="#fef2f2"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em"
              font-size="10" font-family="sans-serif" fill="#b91c1c">
          invalid for ${format}
        </text>`;
    }
  }, [value, format, showText, barColor]);

  return (
    <svg
      ref={ref}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

function sampleFor(format: 'EAN-13' | 'Code128' | 'Code39' | 'UPC-A'): string {
  // Valid encodings for each format so JsBarcode doesn't throw on the
  // designer placeholder. EAN-13 = 13 digits, UPC-A = 12, Code128/39 = any.
  switch (format) {
    case 'EAN-13':
      return '8851234567890';
    case 'UPC-A':
      return '885123456789';
    case 'Code39':
      return 'SAMPLE-001';
    case 'Code128':
    default:
      return 'SAMPLE-001';
  }
}
