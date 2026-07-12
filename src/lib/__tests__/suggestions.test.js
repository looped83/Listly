import { describe, expect, it, vi } from 'vitest';
import { buildSuggestions, frequentSuggestions } from '../suggestions';

// Feste, kleine Produktliste statt der echten 356 Artikel – entkoppelt die
// Tests von künftigen Änderungen an data/products.json.
vi.mock('../../data/products.json', () => ({
  default: {
    categories: [
      { id: 'obst', name: 'Obst & Gemüse', emoji: '🥗' },
      { id: 'proteine', name: 'Tofu & Hülsenfrüchte', emoji: '🫘' },
    ],
    products: [
      { name: 'Apfel', category: 'obst', emoji: '🍎' },
      { name: 'Aprikose', category: 'obst', emoji: '🍑' },
      { name: 'Banane', category: 'obst', emoji: '🍌' },
      { name: 'Tofu', category: 'proteine', emoji: '🧈' },
    ],
  },
}));

vi.mock('../icons', () => ({
  getKnownCategory: vi.fn(() => null),
}));

describe('buildSuggestions', () => {
  it('orders candidates history first, then favorites, then the base list', () => {
    const history = {
      banane: { name: 'Banane', category: 'obst', count: 3, lastPurchased: 100 },
    };
    const result = buildSuggestions(
      '',
      { history, favorites: ['Tofu'], excludeNames: new Set() },
      10,
    );
    expect(result.map((r) => r.name)).toEqual(['Banane', 'Tofu', 'Apfel', 'Aprikose']);
    expect(result.map((r) => r.source)).toEqual(['history', 'favorite', 'base', 'base']);
  });

  it('excludes names already on the current list', () => {
    const result = buildSuggestions(
      '',
      { history: {}, favorites: [], excludeNames: new Set(['apfel']) },
      10,
    );
    expect(result.map((r) => r.name)).not.toContain('Apfel');
  });

  it('deduplicates an item that appears in both history and the base list', () => {
    const history = { apfel: { name: 'Apfel', category: 'obst', count: 1, lastPurchased: 1 } };
    const result = buildSuggestions('', { history, favorites: [], excludeNames: new Set() }, 10);
    expect(result.filter((r) => r.name === 'Apfel')).toHaveLength(1);
    expect(result.find((r) => r.name === 'Apfel').source).toBe('history');
  });

  it('matches an exact substring anywhere in the product name', () => {
    const result = buildSuggestions(
      'prik',
      { history: {}, favorites: [], excludeNames: new Set() },
      10,
    );
    expect(result.map((r) => r.name)).toEqual(['Aprikose']);
  });

  it('respects the limit', () => {
    const result = buildSuggestions('', { history: {}, favorites: [], excludeNames: new Set() }, 2);
    expect(result).toHaveLength(2);
  });

  it('tolerates a single typo via fuzzy matching once the query is long enough', () => {
    const result = buildSuggestions(
      'banene', // statt "banane" – Distanz 1, Länge 6 ≥ Fuzzy-Mindestlänge
      { history: {}, favorites: [], excludeNames: new Set() },
      10,
    );
    expect(result.map((r) => r.name)).toContain('Banane');
  });

  it('does not fuzzy-match below the minimum query length', () => {
    const result = buildSuggestions('bn', { history: {}, favorites: [], excludeNames: new Set() }, 10);
    expect(result).toEqual([]);
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
