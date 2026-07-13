/**
 * Reine Hilfsfunktionen rund um den Einkaufsabschluss. Bewusst ohne React-
 * Bezug und ohne Seiteneffekte, damit die Zustandsberechnung isoliert testbar
 * bleibt und in Komponenten wie im Hook identisch verwendet werden kann.
 */

/**
 * Zählt abgehakte (gekaufte) und offene Artikel.
 * @param {Array<{ checked?: boolean }>} items
 * @returns {{ checkedCount: number, openCount: number, total: number }}
 */
export function summarizeCheckout(items) {
  let checkedCount = 0;
  for (const item of items) {
    if (item.checked) checkedCount += 1;
  }
  return {
    checkedCount,
    openCount: items.length - checkedCount,
    total: items.length,
  };
}

/**
 * Wählt die Artikel aus, die ein Abschluss verbuchen/entfernen würde:
 * standardmäßig nur die abgehakten, mit `includeOpen` alle.
 * @param {Array<{ checked?: boolean }>} items
 * @param {boolean} [includeOpen=false]
 */
export function itemsToComplete(items, includeOpen = false) {
  return includeOpen ? items.slice() : items.filter((item) => item.checked);
}
