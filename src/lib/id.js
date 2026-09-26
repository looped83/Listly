/**
 * Eindeutige ID (UUID v4, sonst ein ausreichend zufälliger Fallback für sehr
 * alte Browser ohne crypto.randomUUID). Gemeinsam genutzt für Artikel,
 * Kundenkarten und Sync-Operationen.
 */
export const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
