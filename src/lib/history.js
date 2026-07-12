import { getKnownCategory } from './icons';

export const normalizeName = (name) => name.trim().toLowerCase();

/** Anzeigename aufräumen (Whitespace normalisieren, Erstbuchstabe groß). */
export function cleanName(name) {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

/**
 * Verbucht einen gekauften Artikel im Verlauf: erhöht die Kaufhäufigkeit und
 * merkt sich den Zeitpunkt. Gibt ein neues History-Objekt zurück (immutable).
 */
export function recordPurchase(history, { name, category }) {
  const key = normalizeName(name);
  if (!key) return history;

  const previous = history[key];
  return {
    ...history,
    [key]: {
      name: cleanName(name),
      category: category ?? previous?.category ?? getKnownCategory(name),
      count: (previous?.count ?? 0) + 1,
      lastPurchased: Date.now(),
    },
  };
}

/** Verlaufseinträge nach Häufigkeit (dann Aktualität) sortiert. */
export function sortedHistory(history) {
  return Object.values(history).sort(
    (a, b) => b.count - a.count || (b.lastPurchased ?? 0) - (a.lastPurchased ?? 0),
  );
}
