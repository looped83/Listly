import { describe, expect, it, vi } from 'vitest';
import { buildSuggestions, frequentSuggestions } from '../suggestions';

// Feste, kleine Produktliste statt der echten ~356 Artikel – entkoppelt die
// Tests von künftigen Änderungen an data/products.json. Enthält bewusst
// Umlaute, Komposita, Mehrwort-Namen, ein Singular (Karotte) und ein Plural
// (Tomaten) sowie Synonym-Ziele (Hafermilch, Kichererbsen, Brokkoli).
vi.mock('../../data/products.json', () => ({
  default: {
    categories: [
      { id: 'obst', name: 'Obst & Gemüse', emoji: '🥗' },
      { id: 'proteine', name: 'Tofu & Hülsenfrüchte', emoji: '🫘' },
      { id: 'milch', name: 'Milchalternativen', emoji: '🥛' },
    ],
    products: [
      { name: 'Apfel', category: 'obst' },
      { name: 'Grüner Apfel', category: 'obst' },
      { name: 'Aprikose', category: 'obst' },
      { name: 'Banane', category: 'obst' },
      { name: 'Karotte', category: 'obst' },
      { name: 'Tomaten', category: 'obst' },
      { name: 'Brokkoli', category: 'obst' },
      { name: 'Tofu', category: 'proteine' },
      { name: 'Kichererbsen', category: 'proteine' },
      { name: 'Hafermilch', category: 'milch' },
      { name: 'Hafermilch Barista', category: 'milch' },
      { name: 'Vegane Butter', category: 'milch' },
      { name: 'Veganer Käse', category: 'milch' },
    ],
  },
}));

vi.mock('../icons', () => ({
  getKnownCategory: vi.fn(() => null),
}));

const EMPTY = { history: {}, favorites: [], excludeNames: new Set() };
const names = (query, ctx = EMPTY, limit = 6) =>
  buildSuggestions(query, ctx, limit).map((r) => r.name);

describe('buildSuggestions – Grundverhalten', () => {
  it('orders candidates history first, then favorites, then the base list', () => {
    const history = {
      banane: { name: 'Banane', category: 'obst', count: 3, lastPurchased: 100 },
    };
    const result = buildSuggestions('', { history, favorites: ['Tofu'], excludeNames: new Set() }, 10);
    expect(result.slice(0, 3).map((r) => r.name)).toEqual(['Banane', 'Tofu', 'Apfel']);
    expect(result.slice(0, 3).map((r) => r.source)).toEqual(['history', 'favorite', 'base']);
  });

  it('excludes names already on the current list', () => {
    expect(names('', { ...EMPTY, excludeNames: new Set(['apfel']) })).not.toContain('Apfel');
  });

  it('deduplicates an item from history and base, keeping the history source', () => {
    const history = { apfel: { name: 'Apfel', category: 'obst', count: 1, lastPurchased: 1 } };
    const result = buildSuggestions('', { history, favorites: [], excludeNames: new Set() }, 10);
    expect(result.filter((r) => r.name === 'Apfel')).toHaveLength(1);
    expect(result.find((r) => r.name === 'Apfel').source).toBe('history');
  });

  it('respects the limit and caps at six by default', () => {
    expect(buildSuggestions('', EMPTY, 2)).toHaveLength(2);
    expect(buildSuggestions('', EMPTY).length).toBeLessThanOrEqual(6);
  });
});

describe('buildSuggestions – Priorität der Trefferstufen', () => {
  // [Beschreibung, Anfrage, erwarteter erster Treffer]
  const topCases = [
    ['exakt vor Präfix', 'apfel', 'Apfel'],
    ['Präfix vor Token-Präfix', 'apf', 'Apfel'],
    ['Mehrwort-Präfix', 'gruner apf', 'Grüner Apfel'],
    ['Synonym (oat milk → Hafermilch)', 'oat milk', 'Hafermilch'],
    ['Synonym (chickpeas → Kichererbsen)', 'chickpeas', 'Kichererbsen'],
    ['Synonym (broccoli → Brokkoli)', 'broccoli', 'Brokkoli'],
  ];
  it.each(topCases)('%s', (_label, query, expectedTop) => {
    expect(names(query)[0]).toBe(expectedTop);
  });

  // [Beschreibung, Anfrage, muss enthalten]
  const containCases = [
    ['Token-Präfix (zweites Wort)', 'butter', 'Vegane Butter'],
    ['Mehrere Token-Präfixe', 'veg but', 'Vegane Butter'],
    ['Teilstring im Kompositum', 'milch', 'Hafermilch'],
    ['Umlaut ä', 'käse', 'Veganer Käse'],
    ['Umlaut ohne Punkte (a)', 'kase', 'Veganer Käse'],
    ['Umlaut ASCII (ae)', 'kaese', 'Veganer Käse'],
    ['Plural-Anfrage, Singular im Katalog', 'karotten', 'Karotte'],
    ['Singular-Anfrage, Plural im Katalog', 'tomate', 'Tomaten'],
    ['Tippfehler (fehlender Buchstabe)', 'hafermich', 'Hafermilch'],
    ['Tippfehler (vertauscht/ersetzt)', 'banene', 'Banane'],
  ];
  it.each(containCases)('%s', (_label, query, mustContain) => {
    expect(names(query)).toContain(mustContain);
  });
});

describe('buildSuggestions – Fehlalarme & Grenzen', () => {
  // [Beschreibung, Anfrage, darf NICHT enthalten]
  const rejectCases = [
    ['unähnliches Wort matcht nicht per Fuzzy', 'apfel', 'Banane'],
    ['Teilstring-Anfrage bringt kein unverwandtes Produkt', 'milch', 'Tofu'],
  ];
  it.each(rejectCases)('%s', (_label, query, mustNotContain) => {
    expect(names(query)).not.toContain(mustNotContain);
  });

  it('liefert nichts für komplett unpassende Eingaben', () => {
    expect(names('xyzqwertz')).toEqual([]);
  });

  it('wendet Fuzzy nicht unterhalb der Mindestlänge an', () => {
    // „bne“ (Länge 3) ist kein Präfix/Teilstring und unter der Fuzzy-Mindestlänge.
    expect(names('bne')).toEqual([]);
  });

  it('bevorzugt exakten Treffer gegenüber bloßem Teilstring', () => {
    // „apfel“: „Apfel“ (exakt) muss vor „Grüner Apfel“ (Token-Präfix) stehen.
    const result = names('apfel');
    expect(result[0]).toBe('Apfel');
    expect(result.indexOf('Apfel')).toBeLessThan(result.indexOf('Grüner Apfel'));
  });

  it('deterministisch: identische Eingabe liefert identische Reihenfolge', () => {
    expect(names('a')).toEqual(names('a'));
  });
});

describe('buildSuggestions – Herkunftspriorität als Tie-Breaker', () => {
  it('reiht bei gleicher Trefferstufe Verlaufsartikel vor Basisartikel', () => {
    // „Tomaten“ aus dem Verlauf, „Tofu“ aus der Basis – beide Token-Präfix zu „to“.
    const history = { tomaten: { name: 'Tomaten', category: 'obst', count: 1, lastPurchased: 1 } };
    const result = names('to', { history, favorites: [], excludeNames: new Set() });
    expect(result.indexOf('Tomaten')).toBeLessThan(result.indexOf('Tofu'));
  });
});

describe('frequentSuggestions', () => {
  it('returns purchased items ordered by descending frequency', () => {
    const history = {
      apfel: { name: 'Apfel', category: 'obst', count: 2, lastPurchased: 10 },
      tofu: { name: 'Tofu', category: 'proteine', count: 5, lastPurchased: 5 },
    };
    const result = frequentSuggestions(history, { excludeNames: new Set() });
    expect(result.map((r) => r.name)).toEqual(['Tofu', 'Apfel']);
  });

  it('excludes items already on the current list', () => {
    const history = {
      apfel: { name: 'Apfel', category: 'obst', count: 2, lastPurchased: 10 },
    };
    const result = frequentSuggestions(history, { excludeNames: new Set(['apfel']) });
    expect(result).toEqual([]);
  });

  it('excludes entries with a zero purchase count', () => {
    const history = {
      apfel: { name: 'Apfel', category: 'obst', count: 0, lastPurchased: 10 },
    };
    const result = frequentSuggestions(history, { excludeNames: new Set() });
    expect(result).toEqual([]);
  });

  it('respects the limit', () => {
    const history = {
      a: { name: 'A', category: null, count: 3, lastPurchased: 1 },
      b: { name: 'B', category: null, count: 2, lastPurchased: 1 },
      c: { name: 'C', category: null, count: 1, lastPurchased: 1 },
    };
    const result = frequentSuggestions(history, { excludeNames: new Set() }, 2);
    expect(result).toHaveLength(2);
  });
});
