import { describe, expect, it } from 'vitest';
import products from '../../data/products.json';
import { buildSuggestions } from '../suggestions';

// Bewusst OHNE Mock: prüft Korrektheit und Laufzeit gegen den echten Katalog
// (~356 Artikel). Der Zeitbudget-Test ist großzügig – er soll keine Mikro-
// Benchmark-Präzision liefern, sondern versehentliche O(n²)-Regressionen (oder
// eine plötzlich sehr teure Normalisierung im Hot Path) auffangen.

const CTX = { history: {}, favorites: [], excludeNames: new Set() };

// Repräsentative Anfragen: Präfixe, Komposita-Teilstrings, Umlaute, Synonyme,
// Tippfehler und ein Fehlalarm.
const QUERIES = [
  'h',
  'ha',
  'haf',
  'hafer',
  'milch',
  'kase',
  'käse',
  'kaese',
  'gruner',
  'oat milk',
  'chickpeas',
  'tomaten',
  'karotten',
  'banene',
  'xyzqwertz',
];

describe('buildSuggestions – Performance & Korrektheit am echten Katalog', () => {
  it('liefert für jede Anfrage höchstens sechs Treffer', () => {
    for (const q of QUERIES) {
      expect(buildSuggestions(q, CTX).length).toBeLessThanOrEqual(6);
    }
  });

  it('findet bekannte Katalogtreffer und Synonyme', () => {
    const has = (q, name) => buildSuggestions(q, CTX).some((r) => r.name === name);
    expect(has('hafer', 'Hafermilch')).toBe(true);
    expect(has('oat milk', 'Hafermilch')).toBe(true);
    expect(has('chickpeas', 'Kichererbsen')).toBe(true);
    // Fehlalarm-Kontrolle: reiner Unsinn ergibt keine Treffer.
    expect(buildSuggestions('xyzqwertz', CTX)).toEqual([]);
  });

  it('deckt den ganzen Katalog ab (Sanity: genug Produkte geladen)', () => {
    expect(products.products.length).toBeGreaterThan(300);
  });

  it('bleibt für viele Aufrufe schnell (Budget großzügig)', () => {
    const ITERATIONS = 40; // 40 × 15 Anfragen = 600 vollständige Bewertungen
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      for (const q of QUERIES) buildSuggestions(q, CTX);
    }
    const elapsed = performance.now() - start;
    // 600 Aufrufe über ~356 Artikel: großzügiges Budget, um CI-Schwankungen und
    // langsame Umgebungen zu tolerieren.
    expect(elapsed).toBeLessThan(1500);
  });
});
