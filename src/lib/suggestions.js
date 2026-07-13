import products from '../data/products.json';
import { getKnownCategory } from './icons';
import { normalizeName, sortedHistory } from './history';
import {
  FUZZY_MIN_LENGTH,
  MATCH,
  describeText,
  fuzzyThreshold,
  matchTier,
  normalizeText,
  substringEditDistance,
  synonymTargets,
} from './textMatch';

// Basisliste einmalig vorbereiten: Name + Metadaten + vorberechnete
// Vergleichsform. Spart die (nicht ganz billige) Normalisierung von 356
// Artikeln bei jedem Tastendruck.
const BASE_PRODUCTS = products.products.map((p) => ({
  name: p.name,
  category: p.category,
  source: 'base',
  key: normalizeName(p.name),
  ...describeText(p.name),
}));

/**
 * Autovervollständigung mit nachvollziehbarer, deterministischer Trefferbewertung.
 *
 * Kandidaten stammen – dedupliziert – aus Kaufverlauf, Favoriten und veganer
 * Basisliste, in **genau dieser** Reihenfolge zusammengestellt. Diese Reihenfolge
 * kodiert die Herkunftspriorität (Verlauf nach Häufigkeit → Favorit → Basis) und
 * dient als stabiler Tie-Breaker (Kandidatenindex).
 *
 * Bewertung je Kandidat (höher = besser, siehe `textMatch.MATCH`):
 *   exakt → Synonym → Präfix → Token-Präfix → Teilstring → Singular/Plural →
 *   (nur bei ausreichend langer Eingabe, mit strenger Schwelle) Tippfehler.
 * Sortiert wird stabil nach: Trefferstufe ↓, Fuzzy-Distanz ↑, Herkunftsindex ↑.
 *
 * Artikel, die bereits auf der Liste stehen (`excludeNames`, normalisiert),
 * werden ausgeblendet. Ergebnis ist dedupliziert und auf `limit` (Standard 6)
 * begrenzt. Bei leerer Eingabe führen die häufigsten Verlaufsartikel.
 */
export function buildSuggestions(query, { history, favorites, excludeNames }, limit = 6) {
  const seen = new Set(excludeNames);

  // Kandidaten in Prioritätsreihenfolge (Verlauf → Favoriten → Basis), dedupliziert.
  const candidates = [];
  const add = (name, category, source, precomputed) => {
    const key = normalizeName(name);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(precomputed ?? { name, category, source, key, ...describeText(name) });
  };
  for (const entry of sortedHistory(history)) add(entry.name, entry.category, 'history');
  for (const name of favorites) add(name, getKnownCategory(name), 'favorite');
  for (const product of BASE_PRODUCTS) add(product.name, product.category, 'base', product);

  const strip = ({ name, category, source }) => ({ name, category, source });

  const qNorm = normalizeText(query);
  // Ohne Eingabe: Prioritätsreihenfolge unverändert übernehmen.
  if (!qNorm) return candidates.slice(0, limit).map(strip);

  const synonyms = synonymTargets(qNorm);
  const allowFuzzy = qNorm.length >= FUZZY_MIN_LENGTH;
  const threshold = fuzzyThreshold(qNorm.length);

  const scored = [];
  candidates.forEach((cand, index) => {
    let tier = matchTier(qNorm, cand);
    if (synonyms.has(cand.norm)) tier = Math.max(tier, MATCH.SYNONYM);

    let fuzzyDistance = 0;
    if (tier === MATCH.NONE && allowFuzzy) {
      const dist = substringEditDistance(qNorm, cand.norm);
      if (dist <= threshold) {
        tier = MATCH.FUZZY;
        fuzzyDistance = dist;
      }
    }

    if (tier > MATCH.NONE) scored.push({ cand, tier, fuzzyDistance, index });
  });

  // Stabil & nachvollziehbar: bessere Stufe zuerst, bei Fuzzy geringere Distanz
  // zuerst, sonst Herkunftsreihenfolge (Index).
  scored.sort(
    (a, b) => b.tier - a.tier || a.fuzzyDistance - b.fuzzyDistance || a.index - b.index,
  );

  return scored.slice(0, limit).map((s) => strip(s.cand));
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
