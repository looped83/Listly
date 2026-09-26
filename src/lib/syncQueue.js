// ─────────────────────────────────────────────────────────────────────────────
//  Warteschlange für Cloud-Schreiboperationen (Offline-Unterstützung).
// ─────────────────────────────────────────────────────────────────────────────
//  Jede Änderung an der geteilten Liste wird als kleine, serialisierbare
//  Operation beschrieben, in localStorage vorgehalten und der Reihe nach an
//  Supabase gesendet. Scheitert das Senden am Netz, bleibt sie stehen und wird
//  beim nächsten Abgleich erneut gesendet – ein Häkchen im Funkloch geht so
//  nicht verloren.
//
//  Alle Operationen sind idempotent (Upsert statt Insert, Update/Delete per
//  id): mehrfaches Senden oder mehrfaches lokales Anwenden ändert nichts am
//  Ergebnis. Das erlaubt einfache, robuste Wiederholungen.
//
//  Operationen:
//    { opId, type: 'upsert', items }           – Artikel anlegen/wiederherstellen
//    { opId, type: 'update', itemId, patch }   – Felder eines Artikels ändern
//    { opId, type: 'delete', itemIds }         – Artikel entfernen

import { itemToRow, TABLE } from './supabase';

const OP_TYPES = new Set(['upsert', 'update', 'delete']);

// Ein einzelner Schreibversuch darf die Warteschlange nicht beliebig lange
// blockieren (hängende Mobilfunkverbindung) – danach gilt er als Netzfehler.
export const OP_TIMEOUT_MS = 10000;

export const byCreatedAt = (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '');

/** Wendet eine Operation auf eine Artikelliste an (pure, idempotent). */
export function applyOp(items, op) {
  if (op.type === 'upsert') {
    const incoming = new Map(op.items.map((item) => [item.id, item]));
    const merged = items.map((it) => incoming.get(it.id) ?? it);
    for (const [id, item] of incoming) {
      if (!items.some((it) => it.id === id)) merged.push(item);
    }
    return merged.sort(byCreatedAt);
  }
  if (op.type === 'update') {
    return items.map((it) => (it.id === op.itemId ? { ...it, ...op.patch } : it));
  }
  const ids = new Set(op.itemIds);
  return items.filter((it) => !ids.has(it.id));
}

/** Wendet alle Operationen der Reihe nach an – Serverstand + eigene Änderungen. */
export const applyOps = (items, ops) => ops.reduce(applyOp, items);

/** Vereinigung zweier Operationslisten (nach opId, Reihenfolge bleibt erhalten). */
export function mergeOps(first, second) {
  const known = new Set(first.map((op) => op.opId));
  return [...first, ...second.filter((op) => !known.has(op.opId))];
}

/**
 * Wiederholbar gescheitert? Netz weg/Timeout (status 0), Server überlastet
 * (5xx) oder Rate-Limit. Andere Fehler (4xx) lehnt die DB inhaltlich ab – ein
 * erneuter Versuch würde nichts ändern.
 */
export const isRetryable = ({ status }) =>
  !status || status >= 500 || status === 408 || status === 429;

/** Sendet eine Operation an Supabase; liefert `{ error, status }`. */
export function runOp(supabase, op) {
  const table = supabase.from(TABLE);
  const query =
    op.type === 'upsert'
      ? // defaultToNull: false → fehlende Spalten (z. B. quantity) nehmen den DB-Standard.
        table.upsert(op.items.map(itemToRow), { defaultToNull: false })
      : op.type === 'update'
        ? table.update(op.patch).eq('id', op.itemId)
        : table.delete().in('id', op.itemIds);
  return typeof AbortSignal !== 'undefined' && AbortSignal.timeout && query.abortSignal
    ? query.abortSignal(AbortSignal.timeout(OP_TIMEOUT_MS))
    : query;
}

/** Nur wohlgeformte Operationen übernehmen (defensiv beim Lesen aus dem Speicher). */
export function sanitizeOps(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (op) =>
      op &&
      typeof op === 'object' &&
      typeof op.opId === 'string' &&
      OP_TYPES.has(op.type) &&
      (op.type !== 'upsert' || Array.isArray(op.items)) &&
      (op.type !== 'update' || (typeof op.itemId === 'string' && op.patch)) &&
      (op.type !== 'delete' || Array.isArray(op.itemIds)),
  );
}
