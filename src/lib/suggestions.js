import products from '../data/products.json';
import { getKnownCategory } from './icons';
import { normalizeName, sortedHistory } from './history';

const BASE_PRODUCTS = products.products.map((p) => ({
  name: p.name,
  category: p.category,
  source: 'base',
}));

// Fuzzy-Suche wird erst ab dieser Eingabelänge zugeschaltet – bei sehr kurzen
// Eingaben liefern schon exakte Teilstring-Treffer genug Vorschläge, und eine
// unscharfe Suche würde dort nur Rauschen erzeugen.
const FUZZY_MIN_LENGTH = 3;

/**
 * Minimale Editierdistanz zwischen `needle` und irgendeinem Teilstring von
 * `haystack` (approximatives Substring-Matching nach Sellers). So toleriert die
 * Suche Tippfehler, ohne dass die Eingabe das ganze Wort abdecken muss:
 * „schamp“ passt z. B. mit Distanz 1 auf „champignons“.
 */
function fuzzySubstringDistance(needle, haystack) {
  const m = needle.length;
  const n = haystack.length;
  if (m === 0) return 0;
  // Erste Zeile 0 → der Treffer darf an beliebiger Position beginnen.
  let prev = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1);
    cur[0] = i; // needle-Zeichen streichen
    for (let j = 1; j <= n; j++) {
      const cost = needle[i - 1] === haystack[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return Math.min(...prev); // bestes Ende an beliebiger Position
}

// Erlaubte Editierdistanz: grob ein Fehler je vier Zeichen, mindestens einer.
const fuzzyThreshold = (length) => Math.max(1, Math.floor(length / 4));

/**
 * Autovervollständigung: Vorschläge aus Kaufverlauf, Favoriten und veganer
 * Basisliste – priorisiert in genau dieser Reihenfolge, dedupliziert, gefiltert
 * nach der Eingabe. Artikel, die bereits auf der Liste stehen (`excludeNames`,
 * normalisiert), werden ausgeblendet.
 *
 * Exakte Teilstring-Treffer stehen unverändert und in Prioritätsreihenfolge
 * oben. Reichen sie nicht bis `limit`, füllen tippfehler-tolerante Fuzzy-Treffer
 * (nach Ähnlichkeit sortiert) die restlichen Plätze auf.
 *
 * Bei leerer Eingabe (Fokus ohne Text) werden Vorschläge trotzdem gezeigt –
 * dann führen die häufigsten Artikel aus dem Kaufverlauf.
 */
export function buildSuggestions(query, { history, favorites, excludeNames }, limit = 6) {
  const q = normalizeName(query);
  const seen = new Set(excludeNames);

  // Kandidaten in Prioritätsreihenfolge (Verlauf → Favoriten → Basis), dedupliziert.
  const candidates = [];
  const add = (name, category, source) => {
    const key = normalizeName(name);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ name, category, source, key });
  };
  for (const entry of sortedHistory(history)) add(entry.name, entry.category, 'history');
  for (const name of favorites) add(name, getKnownCategory(name), 'favorite');
  for (const product of BASE_PRODUCTS) add(product.name, product.category, 'base');

  const strip = ({ name, category, source }) => ({ name, category, source });

  // Ohne Eingabe: Prioritätsreihenfolge unverändert übernehmen.
  if (!q) return candidates.slice(0, limit).map(strip);

  // 1. Exakte Teilstring-Treffer – behalten die Prioritätsreihenfolge (wie bisher).
  const exact = candidates.filter((c) => c.key.includes(q));
  if (exact.length >= limit || q.length < FUZZY_MIN_LENGTH) {
    return exact.slice(0, limit).map(strip);
  }

  // 2. Fuzzy-Treffer füllen die restlichen Plätze auf (nach Ähnlichkeit sortiert;
  //    stabile Sortierung erhält bei Gleichstand die Prioritätsreihenfolge).
  const threshold = fuzzyThreshold(q.length);
  const fuzzy = candidates
    .filter((c) => !c.key.includes(q))
    .map((c) => ({ c, dist: fuzzySubstringDistance(q, c.key) }))
    .filter((x) => x.dist <= threshold)
    .sort((a, b) => a.dist - b.dist)
    .map((x) => x.c);

  return [...exact, ...fuzzy].slice(0, limit).map(strip);
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
