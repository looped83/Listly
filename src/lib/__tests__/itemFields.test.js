import { describe, expect, it } from 'vitest';
import {
  MAX_NOTE_LENGTH,
  MAX_UNIT_LENGTH,
  coerceNote,
  coerceQuantity,
  coerceUnit,
  formatQuantity,
  formatQuantityNumber,
  itemLabel,
  parseQuantityInput,
  readItemExtras,
} from '../itemFields';

describe('coerceQuantity', () => {
  it('akzeptiert positive Zahlen', () => {
    expect(coerceQuantity(2)).toBe(2);
    expect(coerceQuantity(0.5)).toBe(0.5);
  });

  it('akzeptiert Zeichenketten mit Komma oder Punkt', () => {
    expect(coerceQuantity('1,5')).toBe(1.5);
    expect(coerceQuantity('1.5')).toBe(1.5);
    expect(coerceQuantity('  3  ')).toBe(3);
  });

  it('gibt null für nicht positive, leere oder ungültige Werte', () => {
    expect(coerceQuantity(0)).toBeNull();
    expect(coerceQuantity(-2)).toBeNull();
    expect(coerceQuantity('')).toBeNull();
    expect(coerceQuantity('abc')).toBeNull();
    expect(coerceQuantity(null)).toBeNull();
    expect(coerceQuantity(undefined)).toBeNull();
    expect(coerceQuantity(NaN)).toBeNull();
  });
});

describe('coerceUnit / coerceNote', () => {
  it('trimmt und begrenzt die Länge', () => {
    expect(coerceUnit('  g  ')).toBe('g');
    expect(coerceUnit('x'.repeat(50))).toHaveLength(MAX_UNIT_LENGTH);
    expect(coerceNote('  hallo  ')).toBe('hallo');
    expect(coerceNote('y'.repeat(500))).toHaveLength(MAX_NOTE_LENGTH);
  });

  it('gibt bei Nicht-Strings den leeren String', () => {
    expect(coerceUnit(5)).toBe('');
    expect(coerceNote(null)).toBe('');
  });
});

describe('parseQuantityInput', () => {
  it('leere Eingabe ist gültig und ergibt null', () => {
    expect(parseQuantityInput('')).toEqual({ ok: true, value: null });
    expect(parseQuantityInput('   ')).toEqual({ ok: true, value: null });
  });

  it('positive Zahlen (Komma/Punkt) sind gültig', () => {
    expect(parseQuantityInput('2')).toEqual({ ok: true, value: 2 });
    expect(parseQuantityInput('0,25')).toEqual({ ok: true, value: 0.25 });
  });

  it('nicht positive oder nicht-numerische Eingaben sind ungültig', () => {
    expect(parseQuantityInput('0')).toEqual({ ok: false, value: null });
    expect(parseQuantityInput('-1')).toEqual({ ok: false, value: null });
    expect(parseQuantityInput('abc')).toEqual({ ok: false, value: null });
  });
});

describe('formatQuantity', () => {
  it('nur Menge → „2 ד', () => {
    expect(formatQuantity(2, '')).toBe('2 ×');
  });
  it('Menge + Einheit → „500 g"', () => {
    expect(formatQuantity(500, 'g')).toBe('500 g');
  });
  it('Dezimal mit deutschem Komma', () => {
    expect(formatQuantityNumber(0.5)).toBe('0,5');
    expect(formatQuantity(0.5, 'l')).toBe('0,5 l');
  });
  it('ohne Menge → leer (oder reine Einheit)', () => {
    expect(formatQuantity(null, '')).toBe('');
    expect(formatQuantity(null, 'g')).toBe('g');
  });
});

describe('readItemExtras / itemLabel', () => {
  it('liefert normalisierte Defaults', () => {
    expect(readItemExtras({})).toEqual({ quantity: null, unit: '', note: '' });
    expect(readItemExtras({ quantity: '2', unit: ' g ', note: ' x ' })).toEqual({
      quantity: 2,
      unit: 'g',
      note: 'x',
    });
  });

  it('baut ein sprechendes Label inkl. Menge', () => {
    expect(itemLabel({ name: 'Hafermilch', quantity: 2 })).toBe('2 × Hafermilch');
    expect(itemLabel({ name: 'Mehl', quantity: 500, unit: 'g' })).toBe('500 g Mehl');
    expect(itemLabel({ name: 'Tofu' })).toBe('Tofu');
  });
});
