// ─────────────────────────────────────────────────────────────────────────────
//  Reine Helfer für das optionale Artikelfeld Menge.
// ─────────────────────────────────────────────────────────────────────────────
//  Datenmodell: quantity = ganze Zahl ≥ 2 oder nicht gesetzt. Die Menge 1 ist
//  die implizite Standardmenge und wird weder gespeichert noch angezeigt.
//  Ohne React-Bezug und ohne Seiteneffekte – identisch nutzbar im Sanitizer,
//  in der Cloud-Abbildung, in der Anzeige und in den Bearbeiten-Feldern.

/**
 * Menge defensiv auf eine speicher-/anzeigbare Menge normalisieren: eine ganze
 * Zahl ≥ 2 – oder null (nicht gesetzt). Akzeptiert Zahlen und Zahl-Strings
 * (Komma oder Punkt als Dezimaltrenner). 1, 0, Negatives, Nachkommastellen
 * unter 2 und Ungültiges werden zu null, da 1 die implizite Standardmenge ist
 * und nicht materialisiert wird.
 */
export function coerceQuantity(value) {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim().replace(/,/g, '.'))
        : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 2 ? rounded : null;
}

/**
 * Anzeigepräfix für die Menge: „2 ×“ ab einer Menge von 2, sonst leer – die
 * Standardmenge 1 wird bewusst nicht angezeigt. Erwartet eine bereits über
 * coerceQuantity normalisierte Menge (ganze Zahl ≥ 2 oder null).
 */
export function formatQuantity(quantity) {
  return quantity != null && quantity >= 2 ? `${quantity} ×` : '';
}

/** Normalisierte optionale Felder eines Artikels (Defaults für fehlende). */
export function readItemExtras(item) {
  return { quantity: coerceQuantity(item?.quantity) };
}

/**
 * Sprechende Kurzbezeichnung inkl. Menge, z. B. „2 × Hafermilch“.
 * Für aria-labels der Zeilen-Aktionen.
 */
export function itemLabel(item) {
  const prefix = formatQuantity(coerceQuantity(item?.quantity));
  return prefix ? `${prefix} ${item.name}` : item.name;
}
