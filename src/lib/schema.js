// ─────────────────────────────────────────────────────────────────────────────
//  Versioniertes, rückwärtskompatibles localStorage-Schema
// ─────────────────────────────────────────────────────────────────────────────
//
//  Ziel: Bevor die App ihre Daten liest, wird der lokale Speicher einmalig auf
//  den aktuellen Schemastand gebracht. Bestehende Nutzer verlieren dabei keine
//  Daten – Altdaten ohne Versions-Key gelten als Version 1.
//
//  Ablauf von `runMigrations()` (idempotent, läuft bei jedem Start):
//    1. Gespeicherte Schema-Version lesen (`listly.schemaVersion`).
//       • Höher als SCHEMA_VERSION → eine neuere App-Version besitzt diese Daten;
//         nichts anfassen (kein Downgrade).
//    2. Startversion bestimmen: vorhandene Version · 0 (Altdaten ohne Key) ·
//       SCHEMA_VERSION (frische Installation, keine Daten).
//    3. Migrationsschritte der Reihe nach anwenden – jeder Schritt genau einmal
//       (Versions-Gate), rein und separat testbar.
//    4. Jede Datendomäne defensiv validieren (siehe Sanitizer). Beschädigte
//       Werte fallen isoliert auf einen sicheren Standard zurück – nie der
//       gesamte Speicher. Unbekannte Zusatzfelder bleiben erhalten.
//    5. Nur geänderte Keys zurückschreiben, dann die Versionsmarke setzen.
//
//  ── Neue Migration hinzufügen ──────────────────────────────────────────────
//    1. SCHEMA_VERSION um 1 erhöhen.
//    2. In MIGRATIONS einen Schritt `{ version: <neu>, describe, migrate }`
//       ergänzen. `migrate(state)` bekommt ein Snapshot-Objekt
//       `{ items, favorites, history, cards, theme }`, gibt ein neues zurück
//       (pure – keine Seiteneffekte, kein localStorage-Zugriff).
//    3. Schritt idempotent/defensiv halten (nicht auf perfekte Eingaben
//       verlassen – ein beschädigter Versions-Key kann eine erneute Anwendung
//       auslösen).
//    4. Falls nötig einen Sanitizer für neue/geänderte Felder anpassen.
//    5. Test in `__tests__/schema.test.js` ergänzen (siehe vorhandene Fälle).

import { STORAGE_KEYS } from './storage';
import { coerceQuantity, coerceUnit, coerceNote } from './itemFields';

// Aktuelle Zielversion des Schemas.
//   Version 1 = Basis-Datenmodell (items, favorites, history, cards, theme).
//   Version 2 = Artikel um optionale Felder quantity/unit/note erweitert.
export const SCHEMA_VERSION = 2;

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ── Defensive Sanitizer (pure) ───────────────────────────────────────────────
// Jeder validiert genau eine Domäne. Gültige Einträge (inkl. unbekannter
// Zusatzfelder) bleiben erhalten; nur eindeutig defekte Einträge werden
// verworfen. Ist der ganze Wert defekt, greift der Domänen-Standard.

/**
 * Liste: Array von `{ id, name, category, checked, createdAt?, quantity?, unit?, note? }`.
 * Die optionalen Felder quantity/unit/note werden normalisiert und nur bei
 * Bedarf geschrieben (omit-empty) – so bleiben Altdaten unverändert gültig und
 * der Speicher schlank.
 */
export function sanitizeItems(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) continue;
    if (typeof entry.name !== 'string' || entry.name.trim() === '') continue;
    const { id, name, category, checked, createdAt, quantity, unit, note, ...rest } = entry;
    const clean = {
      ...rest, // unbekannte Zusatzfelder erhalten
      id: typeof id === 'string' && id ? id : createId(),
      name,
      category: typeof category === 'string' ? category : null,
      checked: Boolean(checked),
    };
    if (typeof createdAt === 'string') clean.createdAt = createdAt;

    const q = coerceQuantity(quantity);
    if (q !== null) clean.quantity = q;
    const u = coerceUnit(unit);
    if (u) clean.unit = u;
    const n = coerceNote(note);
    if (n) clean.note = n;

    out.push(clean);
  }
  return out;
}

/** Favoriten: Array von Namen (Strings). */
export function sanitizeFavorites(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((name) => typeof name === 'string');
}

/** Kaufverlauf: `{ [key]: { name, category, count, lastPurchased } }`. */
export function sanitizeHistory(value) {
  if (!isPlainObject(value)) return {};
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isPlainObject(entry)) continue;
    if (typeof entry.name !== 'string' || entry.name.trim() === '') continue;
    const { name, category, count, lastPurchased, ...rest } = entry;
    out[key] = {
      ...rest, // unbekannte Zusatzfelder erhalten
      name,
      category: typeof category === 'string' ? category : null,
      count: Number.isFinite(count) ? count : 0,
      lastPurchased: Number.isFinite(lastPurchased) ? lastPurchased : 0,
    };
  }
  return out;
}

/**
 * Kundenkarten: Array von Karten-Objekten. Bewusst reine Durchreiche – Karten
 * enthalten persönliche, gerätelokale und schwer wiederherstellbare Daten
 * (u. a. das optionale Feld `number`). Es werden ausschließlich Nicht-Objekte
 * verworfen; alle Felder gültiger Karten bleiben unangetastet.
 */
export function sanitizeCards(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((card) => isPlainObject(card));
}

/** Theme: ein String (historisch, aktuell ungenutzt); sonst entfernt. */
export function sanitizeTheme(value) {
  return typeof value === 'string' ? value : undefined;
}

// ── Domänen des Schemas ──────────────────────────────────────────────────────
// name  – Schlüssel im Snapshot-Objekt der Migrationen
// key   – localStorage-Key
// empty – Standardwert bei fehlendem/defektem Wert (undefined = Key entfernen)
const DOMAINS = [
  { name: 'items', key: STORAGE_KEYS.items, sanitize: sanitizeItems, empty: () => [] },
  { name: 'favorites', key: STORAGE_KEYS.favorites, sanitize: sanitizeFavorites, empty: () => [] },
  { name: 'history', key: STORAGE_KEYS.history, sanitize: sanitizeHistory, empty: () => ({}) },
  { name: 'cards', key: STORAGE_KEYS.cards, sanitize: sanitizeCards, empty: () => [] },
  { name: 'theme', key: STORAGE_KEYS.theme, sanitize: sanitizeTheme, empty: () => undefined },
];

// ── Migrationsschritte ───────────────────────────────────────────────────────
// Aufsteigend nach `version`. Jeder Schritt ist pure: `(state) => newState`.
export const MIGRATIONS = [
  {
    version: 1,
    describe:
      'Baseline v1: bestehende Keys (items, favorites, history, cards, theme) unverändert als Schema-Version 1 übernehmen.',
    migrate: (state) => state,
  },
  {
    version: 2,
    describe:
      'v2: Artikel um optionale Felder quantity/unit/note erweitern. Additiv und ' +
      'rückwärtskompatibel – Altartikel bleiben unverändert gültig; die eigentliche ' +
      'Normalisierung/Begrenzung übernimmt der (bei jedem Start laufende) sanitizeItems.',
    migrate: (state) => state,
  },
];

// ── Interne Helfer ───────────────────────────────────────────────────────────

function safeLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // z. B. Zugriff im Private-Mode verweigert
  }
}

function parseOr(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback; // defektes JSON → isolierter Domänen-Fallback
  }
}

function readSchemaVersion(storage) {
  const raw = storage.getItem(STORAGE_KEYS.schemaVersion);
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw);
    return Number.isInteger(v) && v >= 0 ? v : null;
  } catch {
    return null; // defekte Versionsmarke → als unversioniert behandeln
  }
}

function persistDomain(storage, domain, oldRaw, value) {
  if (value === undefined) {
    // Kein gültiger Wert (z. B. theme): nur einen vorhandenen Key entfernen.
    if (oldRaw !== null) storage.removeItem(domain.key);
    return;
  }
  const next = JSON.stringify(value);
  // Einen nie vorhandenen Key nicht mit einem leeren Standard materialisieren.
  if (oldRaw === null && next === JSON.stringify(domain.empty())) return;
  if (next !== oldRaw) storage.setItem(domain.key, next);
}

/**
 * Bringt den lokalen Speicher auf SCHEMA_VERSION. Muss **vor dem ersten Lesen**
 * der App-Daten laufen (siehe main.jsx). Wirft nie – im Fehlerfall bleibt der
 * Speicher unangetastet und die App liest mit ihren eigenen Fallbacks weiter.
 *
 * @param {Storage} [storage] localStorage-artiges Objekt (für Tests injizierbar).
 * @returns {{ status: string, from?: number, to?: number, applied?: number[] }}
 */
export function runMigrations(storage = safeLocalStorage()) {
  if (!storage) return { status: 'skipped-no-storage' };

  try {
    const storedVersion = readSchemaVersion(storage);

    // Neuere, unbekannte Version → nichts anfassen (kein Downgrade).
    if (storedVersion !== null && storedVersion > SCHEMA_VERSION) {
      return { status: 'future', from: storedVersion, to: storedVersion, applied: [] };
    }

    // Rohwerte + defensiv geparste Snapshot-Werte je Domäne lesen.
    const rawByName = {};
    const snapshot = {};
    for (const domain of DOMAINS) {
      const raw = storage.getItem(domain.key);
      rawByName[domain.name] = raw;
      snapshot[domain.name] = parseOr(raw, domain.empty());
    }

    // Startversion bestimmen.
    const hasLegacyData = DOMAINS.some((d) => rawByName[d.name] !== null);
    let fromVersion;
    if (storedVersion !== null) fromVersion = storedVersion;
    else if (hasLegacyData) fromVersion = 0; // Altdaten ohne Versions-Key
    else fromVersion = SCHEMA_VERSION; // frische Installation

    // Migrationen anwenden (jede genau einmal dank Versions-Gate).
    let state = snapshot;
    const applied = [];
    for (const step of MIGRATIONS) {
      if (step.version > fromVersion && step.version <= SCHEMA_VERSION) {
        state = step.migrate(state);
        applied.push(step.version);
      }
    }

    // Immer defensiv validieren (idempotent; repariert Beschädigungen isoliert).
    for (const domain of DOMAINS) {
      const clean = domain.sanitize(state[domain.name]);
      persistDomain(storage, domain, rawByName[domain.name], clean);
    }

    storage.setItem(STORAGE_KEYS.schemaVersion, JSON.stringify(SCHEMA_VERSION));
    return { status: 'ok', from: fromVersion, to: SCHEMA_VERSION, applied };
  } catch {
    // Unerwarteter Fehler: Speicher nicht weiter verändern, App startet trotzdem.
    return { status: 'error' };
  }
}
