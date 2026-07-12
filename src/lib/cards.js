// Kundenkarten-Hilfen: Händler-Metadaten, Sortierung, Barcode-Format.

export const RETAILERS = {
  lidl: { label: 'Lidl Plus', color: '#0050aa', order: 0 },
  payback: { label: 'Payback', color: '#0a4595', order: 1 },
  dm: { label: 'dm', color: '#20366b', order: 2 },
  custom: { label: 'Kundenkarte', color: '#555555', order: 9 },
};

// Auswahlreihenfolge im Formular (Wunsch: Lidl, Payback, dm, dann Eigene).
export const RETAILER_ORDER = ['lidl', 'payback', 'dm', 'custom'];

export function retailerMeta(retailer) {
  return RETAILERS[retailer] ?? RETAILERS.custom;
}

/** Karten nach Händler-Reihenfolge sortieren. */
export function sortCards(cards) {
  return [...cards].sort((a, b) => retailerMeta(a.retailer).order - retailerMeta(b.retailer).order);
}

function isValidEan13(digits) {
  if (!/^\d{13}$/.test(digits)) return false;
  const nums = [...digits].map(Number);
  const sum = nums.slice(0, 12).reduce((acc, n, i) => acc + n * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === nums[12];
}

/**
 * Wählt ein passendes Barcode-Format: gültige 13-stellige Nummern als EAN-13
 * (z. B. Payback), sonst CODE128 (kodiert beliebige Ziffernfolgen zuverlässig).
 */
export function barcodeFormat(number) {
  const clean = (number || '').replace(/\s/g, '');
  return isValidEan13(clean) ? 'EAN13' : 'CODE128';
}

export function cleanNumber(number) {
  return (number || '').replace(/\s+/g, '').trim();
}
