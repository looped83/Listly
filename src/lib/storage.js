// Zentrale localStorage-Schicht. Ersetzt das in Claude-Artifacts verfügbare
// window.storage durch echtes localStorage bei identischer Datenstruktur:
//   items      – aktuelle Liste:  [{ id, name, category, checked }]
//   favorites  – Favoriten:        [name, ...]
//   history    – Kaufverlauf:      { [normalizedName]: { name, category, count, lastPurchased } }
//   theme      – 'light' | 'dark' | 'system'

export const STORAGE_KEYS = {
  items: 'listly.items',
  favorites: 'listly.favorites',
  history: 'listly.history',
  theme: 'listly.theme',
  cards: 'listly.cards',
};

/** Liest und parst einen Wert; fällt bei Fehlern auf `fallback` zurück. */
export function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Serialisiert und schreibt einen Wert (Fehler werden bewusst geschluckt). */
export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher voll oder nicht verfügbar (z. B. Private Mode) – ignorieren.
  }
}
