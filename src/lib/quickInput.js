// ─────────────────────────────────────────────────────────────────────────────
//  Konservative Schnelleingabe: erkennt eine führende Menge/Einheit und eine
//  optionale Notiz in der freien Artikeleingabe – ohne normale Produktnamen mit
//  Zahlen (z. B. „0% Joghurt", „7Up", „3-Minuten-Terrine") zu zerlegen.
// ─────────────────────────────────────────────────────────────────────────────
//  Leitprinzip: Im Zweifel bleibt die komplette Eingabe der Artikelname.
//  Reine Funktion, kein React-/Storage-Bezug – identisch nutzbar in Tests und UI.

import { cleanName } from './history';
import { coerceQuantity, coerceUnit, coerceNote } from './itemFields';

/**
 * Erlaubte Maßeinheiten → kanonische Schreibweise. Nur eindeutige Gewichts-/
 * Volumeneinheiten; bewusst keine Verpackungs-/Stückwörter (Bund, Dose, Stk …),
 * um die Fehlinterpretationsfläche klein zu halten. Leicht erweiterbar. Schlüssel
 * sind kleingeschrieben; der Abgleich erfolgt case-insensitiv.
 */
export const QUICK_UNIT_ALIASES = {
  g: 'g',
  gr: 'g',
  gramm: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilogramm: 'kg',
  mg: 'mg',
  l: 'l',
  ltr: 'l',
  liter: 'l',
  ml: 'ml',
  milliliter: 'ml',
  cl: 'cl',
  dl: 'dl',
};

// Zahl mit Dezimalkomma ODER -punkt (Multiplikator/Einheit dürfen Dezimalstellen
// haben; die reine Anzahl bewusst nur Ganzzahlen – s. u.).
const NUMBER = '(\\d+(?:[.,]\\d+)?)';

// 1. Multiplikator: „2x …" / „2 × …". Nach dem x/× ist Leerraum nötig und der Name
//    muss mit einem Buchstaben beginnen (schützt vor „2x4 …" o. Ä.).
const MULTIPLIER_RE = new RegExp(`^${NUMBER}\\s*[x×]\\s+(\\p{L}[\\s\\S]*)$`, 'u');

// 2. Menge + Einheit: „500 g …" / „1,5 l …". Das mittlere Token wird nur als
//    Einheit akzeptiert, wenn es in QUICK_UNIT_ALIASES steht.
const UNIT_RE = new RegExp(`^${NUMBER}\\s+([^\\s]+)\\s+(\\p{L}[\\s\\S]*)$`, 'u');

// 3. Reine Anzahl: „3 Bananen". Bewusst nur Ganzzahlen, damit Dezimalangaben ohne
//    Einheit nicht als Anzahl fehlinterpretiert werden.
const COUNT_RE = /^(\d+)\s+(\p{L}[\s\S]*)$/u;

/** Leeres/„nur Name"-Ergebnis mit sauber getrimmtem Namen. */
function nameOnly(name) {
  return { name: cleanName(name), quantity: null, unit: '', note: '' };
}

/**
 * Zerlegt eine freie Eingabe konservativ in strukturierte Felder.
 *
 * @param {string} raw
 * @returns {{ name: string, quantity: number|null, unit: string, note: string }}
 *   quantity ist eine positive Zahl oder null; unit/note sind getrimmte (und
 *   begrenzte) Zeichenketten oder ''. Der Name ist stets bereinigt (cleanName).
 */
export function parseQuickInput(raw) {
  if (typeof raw !== 'string') return nameOnly('');

  // 1. Notiz zuerst und unabhängig abtrennen (Text ab dem ersten „#").
  const hashIndex = raw.indexOf('#');
  const core = (hashIndex === -1 ? raw : raw.slice(0, hashIndex)).trim();
  const note = hashIndex === -1 ? '' : coerceNote(raw.slice(hashIndex + 1));

  // Kein Produktteil (z. B. Eingabe nur „#reif") → alles bleibt Name (Fallback).
  if (core === '') return nameOnly(raw);

  // 2. Multiplikator.
  const mult = core.match(MULTIPLIER_RE);
  if (mult) {
    return { name: cleanName(mult[2]), quantity: coerceQuantity(mult[1]), unit: '', note };
  }

  // 3. Menge + bekannte Einheit.
  const withUnit = core.match(UNIT_RE);
  if (withUnit) {
    const canonical = QUICK_UNIT_ALIASES[withUnit[2].toLowerCase()];
    if (canonical) {
      return {
        name: cleanName(withUnit[3]),
        quantity: coerceQuantity(withUnit[1]),
        unit: coerceUnit(canonical),
        note,
      };
    }
  }

  // 4. Reine Anzahl (Ganzzahl).
  const count = core.match(COUNT_RE);
  if (count) {
    return { name: cleanName(count[2]), quantity: coerceQuantity(count[1]), unit: '', note };
  }

  // 5. Kein eindeutiges Präfix → Kern ist der Name (Notiz bleibt erhalten).
  return { name: cleanName(core), quantity: null, unit: '', note };
}
