import { describe, expect, it } from 'vitest';
import {
  coerceQuantity,
  formatQuantity,
  itemLabel,
  readItemExtras,
} from '../itemFields';

describe('coerceQuantity', () => {
  it('akzeptiert ganze Zahlen ab 2', () => {
    expect(coerceQuantity(2)).toBe(2);
    expect(coerceQuantity(5)).toBe(5);
  });

  it('behandelt 1 als impliziten Standard (→ null, nicht materialisiert)', () => {
    expect(coerceQuantity(1)).toBeNull();
  });

  it('akzeptiert Zahl-Strings (Komma/Punkt) und rundet auf ganze Zahlen', () => {
    expect(coerceQuantity('3')).toBe(3);
    expect(coerceQuantity('2,4')).toBe(2);
    expect(coerceQuantity('2.6')).toBe(3);
  });

  it('gibt null für nicht positive, zu kleine, leere oder ungültige Werte', () => {
    expect(coerceQuantity(0)).toBeNull();
    expect(coerceQuantity(-2)).toBeNull();
    expect(coerceQuantity(0.5)).toBeNull(); // rundet auf 1 → unter 2
    expect(coerceQuantity('')).toBeNull();
    expect(coerceQuantity('abc')).toBeNull();
    expect(coerceQuantity(null)).toBeNull();
    expect(coerceQuantity(undefined)).toBeNull();
    expect(coerceQuantity(NaN)).toBeNull();
  });
});

describe('formatQuantity', () => {
  it('zeigt die Menge ab 2 als „N ×“', () => {
    expect(formatQuantity(2)).toBe('2 ×');
    expect(formatQuantity(12)).toBe('12 ×');
  });

  it('zeigt die Standardmenge 1 (bzw. keine Menge) nicht an', () => {
    expect(formatQuantity(1)).toBe('');
    expect(formatQuantity(null)).toBe('');
    expect(formatQuantity(undefined)).toBe('');
  });
});

describe('readItemExtras / itemLabel', () => {
  it('liefert die normalisierte Menge (Default null)', () => {
    expect(readItemExtras({})).toEqual({ quantity: null });
    expect(readItemExtras({ quantity: '3' })).toEqual({ quantity: 3 });
    expect(readItemExtras({ quantity: 1 })).toEqual({ quantity: null });
  });

  it('baut ein sprechendes Label inkl. Menge', () => {
    expect(itemLabel({ name: 'Hafermilch', quantity: 2 })).toBe('2 × Hafermilch');
    expect(itemLabel({ name: 'Tofu' })).toBe('Tofu');
    expect(itemLabel({ name: 'Apfel', quantity: 1 })).toBe('Apfel'); // 1 wird nicht gezeigt
  });
});
