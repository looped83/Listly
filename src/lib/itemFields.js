// ─────────────────────────────────────────────────────────────────────────────
//  Reine Helfer für die optionalen Artikelfelder Menge und Einheit.
// ─────────────────────────────────────────────────────────────────────────────
//  Ziel-Datenmodell (rückwärtskompatibel, beide optional):
//    quantity : positive Zahl oder null
//    unit     : kurze, getrimmte Zeichenkette oder ''
//  Ohne React-Bezug und ohne Seiteneffekte – identisch nutzbar im Sanitizer,
//  in der Migration, in der Anzeige und in der Validierung des Dialogs.

export const MAX_UNIT_LENGTH = 16;

/**
 * Menge aus beliebiger Eingabe defensiv zu einer positiven Zahl oder null.
 * Akzeptiert Zahlen und Zeichenketten mit Dezimalkomma ODER -punkt.
 * Ungültige oder nicht positive Werte werden still zu null (Speicher-Sanitizer).
 */
export function coerceQuantity(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed.replace(/,/g, '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/** Einheit: getrimmt und auf MAX_UNIT_LENGTH begrenzt (sonst ''). */
export function coerceUnit(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_UNIT_LENGTH) : '';
}

/**
 * Validiert die Mengen-Eingabe des Dialogs. Unterscheidet bewusst „leer"
 * (gültig → null) von „ungültig" (nicht numerisch oder ≤ 0), damit das
 * Formular gezielt Fehler anzeigen kann.
 * @returns {{ ok: boolean, value: number|null }}
 */
export function parseQuantityInput(raw) {
  const str = (typeof raw === 'string' ? raw : String(raw ?? '')).trim();
  if (str === '') return { ok: true, value: null };
  const n = Number(str.replace(/,/g, '.'));
  if (!Number.isFinite(n) || n <= 0) return { ok: false, value: null };
  return { ok: true, value: n };
}

/** Zahl mit deutschem Dezimalkomma darstellen (2 → „2", 0.5 → „0,5"). */
export function formatQuantityNumber(n) {
  return String(n).replace('.', ',');
}

/**
 * Kompaktes Mengen-/Einheiten-Präfix für die Anzeige:
 *   (2, '')     → „2 ×"
 *   (500, 'g')  → „500 g"
 *   (null, 'g') → „g"   (seltener Fall: Einheit ohne Menge)
 *   (null, '')  → ''
 */
export function formatQuantity(quantity, unit) {
  const u = typeof unit === 'string' ? unit.trim() : '';
  if (quantity === null || quantity === undefined) return u;
  const num = formatQuantityNumber(quantity);
  return u ? `${num} ${u}` : `${num} ×`;
}

/** Normalisierte optionale Felder eines Artikels (Defaults für fehlende). */
export function readItemExtras(item) {
  return {
    quantity: coerceQuantity(item?.quantity),
    unit: coerceUnit(item?.unit),
  };
}

/**
 * Sprechende Kurzbezeichnung inkl. Menge/Einheit, z. B. „2 × Hafermilch".
 * Für aria-labels der Zeilen-Aktionen.
 */
export function itemLabel(item) {
  const { quantity, unit } = readItemExtras(item);
  const prefix = formatQuantity(quantity, unit);
  return prefix ? `${prefix} ${item.name}` : item.name;
}
