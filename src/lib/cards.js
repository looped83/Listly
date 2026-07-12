// Kundenkarten-Hilfen: Händler-Metadaten, Sortierung, Barcode-Format.

export const RETAILERS = {
  lidl: { label: 'Lidl Plus', color: '#0050aa', order: 0, codeType: 'qr' },
  payback: { label: 'Payback', color: '#0a4595', order: 1, codeType: 'barcode' },
  dm: { label: 'dm', color: '#20366b', order: 2, codeType: 'qr' },
  rewe: { label: 'REWE', color: '#cc071e', order: 3, codeType: 'qr' },
  custom: { label: 'Kundenkarte', color: '#555555', order: 9, codeType: 'qr' },
};

// Auswahlreihenfolge im Formular (Wunsch: Lidl, Payback, dm, REWE, dann Eigene).
export const RETAILER_ORDER = ['lidl', 'payback', 'dm', 'rewe', 'custom'];

export function retailerMeta(retailer) {
  return RETAILERS[retailer] ?? RETAILERS.custom;
}

/** Karten nach Händler-Reihenfolge sortieren. */
export function sortCards(cards) {
  return [...cards].sort((a, b) => retailerMeta(a.retailer).order - retailerMeta(b.retailer).order);
}

/** Zu kodierender Inhalt: exakter Code-Inhalt, sonst die (Anzeige-)Nummer. */
export function cardContent(card) {
  const explicit = (card.code || '').trim();
  return explicit || cleanNumber(card.number);
}

/** Code-Typ einer Karte (mit Rückfall auf den Händler-Standard). */
export function cardCodeType(card) {
  return card.codeType || retailerMeta(card.retailer).codeType;
}

function isValidEan13(digits) {
  if (!/^\d{13}$/.test(digits)) return false;
  const nums = [...digits].map(Number);
  const sum = nums.slice(0, 12).reduce((acc, n, i) => acc + n * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === nums[12];
}

/**
 * Passendes Barcode-Format: gültige 13-stellige Ziffern als EAN-13, sonst
 * CODE128 (kodiert beliebige Zeichenfolgen zuverlässig).
 */
export function barcodeFormat(value) {
  const clean = (value || '').replace(/\s/g, '');
  return isValidEan13(clean) ? 'EAN13' : 'CODE128';
}

export function cleanNumber(number) {
  return (number || '').replace(/\s+/g, '').trim();
}
