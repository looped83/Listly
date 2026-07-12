import products from '../data/products.json';
import { getKnownCategory } from './icons';
import { normalizeName, sortedHistory } from './history';

const BASE_PRODUCTS = products.products.map((p) => ({
  name: p.name,
  category: p.category,
  source: 'base',
}));

/**
 * Autovervollständigung: Vorschläge aus Kaufverlauf, Favoriten und veganer
 * Basisliste – priorisiert in genau dieser Reihenfolge, dedupliziert, gefiltert
 * nach der Eingabe. Artikel, die bereits auf der Liste stehen (`excludeNames`,
 * normalisiert), werden ausgeblendet.
 */
export function buildSuggestions(query, { history, favorites, excludeNames }, limit = 6) {
  const q = normalizeName(query);
  if (!q) return [];

  const seen = new Set(excludeNames);
  const result = [];

  const consider = (name, category, source) => {
    if (result.length >= limit) return;
    const key = normalizeName(name);
    if (seen.has(key) || !key.includes(q)) return;
    seen.add(key);
    result.push({ name, category, source });
  };

  // 1. Kaufverlauf (nach Häufigkeit)
  for (const entry of sortedHistory(history)) {
    consider(entry.name, entry.category, 'history');
  }
  // 2. Favoriten
  for (const name of favorites) {
    consider(name, getKnownCategory(name), 'favorite');
  }
  // 3. Vegane Basisliste
  for (const product of BASE_PRODUCTS) {
    consider(product.name, product.category, 'base');
  }

  return result;
}

/**
 * Chips für häufig gekaufte Artikel: die meistgekauften Verlaufseinträge, die
 * nicht bereits auf der aktuellen Liste stehen.
 */
export function frequentSuggestions(history, { excludeNames }, limit = 8) {
  const exclude = new Set(excludeNames);
  return sortedHistory(history)
    .filter((entry) => entry.count > 0 && !exclude.has(normalizeName(entry.name)))
    .slice(0, limit);
}
