// ─────────────────────────────────────────────────────────────────────────────
//  Reine Hilfsfunktion: Artikel nach Kategorie gruppieren. Ohne React-Bezug und
//  ohne Seiteneffekte – identisch nutzbar in der Liste und in Tests.
// ─────────────────────────────────────────────────────────────────────────────

import { categoryInfo } from './icons';

/**
 * Gruppiert Artikel nach Kategorie:
 * - Reihenfolge und Anzeigename kommen aus `products.json` (via `categoryInfo`).
 * - Kategorien ohne Artikel tauchen nicht auf.
 * - Unbekannte UND fehlende Kategorien landen gemeinsam in einer einzigen
 *   „Sonstiges“-Gruppe (zuletzt, da deren Reihenfolge-Wert am höchsten ist) –
 *   `categoryInfo` löst beide Fälle auf dieselbe Kategorie-`id` auf, sodass hier
 *   keine zwei separaten Gruppen entstehen können.
 * - Innerhalb einer Kategorie bleibt die Eingabereihenfolge erhalten (stabil):
 *   die Artikel werden nur in Eimer sortiert, nie untereinander umsortiert.
 *
 * @param {Array<{ category?: string|null }>} items
 * @returns {Array<{ category: { id: string, name: string, emoji: string, order: number }, items: Array }>}
 */
export function groupByCategory(items) {
  const byCategory = new Map();
  for (const item of items) {
    const info = categoryInfo(item.category);
    if (!byCategory.has(info.id)) byCategory.set(info.id, { category: info, items: [] });
    byCategory.get(info.id).items.push(item);
  }
  return [...byCategory.values()].sort((a, b) => a.category.order - b.category.order);
}
