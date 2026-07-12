import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanName, normalizeName, recordPurchase, sortedHistory } from '../history';

vi.mock('../icons', () => ({
  getKnownCategory: vi.fn((name) => (name === 'Apfel' ? 'obst-gemuese' : null)),
}));

describe('normalizeName', () => {
  it('trims surrounding whitespace and lowercases', () => {
    expect(normalizeName('  Hafermilch  ')).toBe('hafermilch');
  });

  it('lowercases names with umlauts', () => {
    expect(normalizeName('Käse')).toBe('käse');
  });

  it('treats differently-cased input as the same key', () => {
    expect(normalizeName('TOFU')).toBe(normalizeName('tofu'));
  });
});

describe('cleanName', () => {
  it('collapses internal whitespace runs to a single space', () => {
    expect(cleanName('Hafer   milch')).toBe('Hafer milch');
  });

  it('trims and capitalizes only the first letter', () => {
    expect(cleanName('  hafermilch  ')).toBe('Hafermilch');
  });

  it('leaves the case of the remaining letters untouched', () => {
    expect(cleanName('haferMILCH')).toBe('HaferMILCH');
  });

  it('returns an empty string for blank input', () => {
    expect(cleanName('   ')).toBe('');
  });

  it('normalizes tabs and newlines as whitespace', () => {
    expect(cleanName('hafer\tmilch\n')).toBe('Hafer milch');
  });
});

describe('recordPurchase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a new entry with count 1 and the current timestamp', () => {
    const result = recordPurchase({}, { name: 'hafermilch', category: 'milchalternativen' });
    expect(result.hafermilch).toEqual({
      name: 'Hafermilch',
      category: 'milchalternativen',
      count: 1,
      lastPurchased: Date.now(),
    });
  });

  it('increments the count for an existing entry', () => {
    const history = {
      hafermilch: {
        name: 'Hafermilch',
        category: 'milchalternativen',
        count: 2,
        lastPurchased: 1000,
      },
    };
    const result = recordPurchase(history, { name: 'Hafermilch', category: 'milchalternativen' });
    expect(result.hafermilch.count).toBe(3);
    expect(result.hafermilch.lastPurchased).toBe(Date.now());
  });

  it('keeps the previous category when none is supplied', () => {
    const history = {
      tofu: { name: 'Tofu', category: 'proteine', count: 1, lastPurchased: 1000 },
    };
    const result = recordPurchase(history, { name: 'Tofu' });
    expect(result.tofu.category).toBe('proteine');
  });

  it('falls back to the known base-list category for a brand-new item', () => {
    const result = recordPurchase({}, { name: 'Apfel' });
    expect(result.apfel.category).toBe('obst-gemuese');
  });

  it('uses null category for an unknown new item without an explicit category', () => {
    const result = recordPurchase({}, { name: 'Kein Basisprodukt' });
    expect(result['kein basisprodukt'].category).toBeNull();
  });

  it('does not mutate the input history object (immutability)', () => {
    const history = { apfel: { name: 'Apfel', category: 'obst-gemuese', count: 1, lastPurchased: 1 } };
    const frozen = JSON.parse(JSON.stringify(history));
    recordPurchase(history, { name: 'Apfel' });
    expect(history).toEqual(frozen);
  });

  it('returns the same history reference unchanged for a blank name', () => {
    const history = { apfel: { name: 'Apfel', category: null, count: 1, lastPurchased: 1 } };
    const result = recordPurchase(history, { name: '   ' });
    expect(result).toBe(history);
  });
});

describe('sortedHistory', () => {
  it('sorts entries by descending purchase count', () => {
    const history = {
      a: { name: 'A', category: null, count: 1, lastPurchased: 100 },
      b: { name: 'B', category: null, count: 5, lastPurchased: 50 },
      c: { name: 'C', category: null, count: 3, lastPurchased: 10 },
    };
    expect(sortedHistory(history).map((e) => e.name)).toEqual(['B', 'C', 'A']);
  });

  it('breaks ties in count by the most recent purchase', () => {
    const history = {
      a: { name: 'A', category: null, count: 2, lastPurchased: 100 },
      b: { name: 'B', category: null, count: 2, lastPurchased: 500 },
    };
    expect(sortedHistory(history).map((e) => e.name)).toEqual(['B', 'A']);
  });

  it('returns an empty array for an empty history', () => {
    expect(sortedHistory({})).toEqual([]);
  });
});
