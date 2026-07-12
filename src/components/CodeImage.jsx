import { memo, useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';
import JsBarcode from 'jsbarcode';

/** QR-Code als Bild (aus beliebigem Text/Nummer erzeugt). */
export const QRCode = memo(function QRCode({ value, size = 220 }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    let active = true;
    QRCodeLib.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: 'M' })
      .then((dataUrl) => active && setUrl(dataUrl))
      .catch(() => active && setUrl(''));
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!url) return null;
  return <img className="code__qr" src={url} width={size} height={size} alt="QR-Code" />;
});

/** Klassischer Barcode (EAN-13 oder CODE128) als SVG. */
export const Barcode = memo(function Barcode({ value, format = 'CODE128' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const opts = { displayValue: false, margin: 0, height: 64, width: 2, background: 'transparent' };
    try {
      JsBarcode(ref.current, value, { ...opts, format });
    } catch {
      // Ungültig für das gewählte Format → robuster CODE128-Fallback.
      try {
        JsBarcode(ref.current, value, { ...opts, format: 'CODE128' });
      } catch {
        /* ignore */
      }
    }
  }, [value, format]);

  return <svg ref={ref} className="code__barcode" aria-label="Barcode" />;
});
