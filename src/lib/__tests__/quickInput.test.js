import { describe, expect, it } from 'vitest';
import { QUICK_UNIT_ALIASES, parseQuickInput } from '../quickInput';

// Kurzschreibweise für erwartete Felder (Defaults: keine Menge/Einheit/Notiz).
const expected = ({ name, quantity = null, unit = '', note = '' }) => ({
  name,
  quantity,
  unit,
  note,
});

describe('parseQuickInput – gültige Schnelleingaben', () => {
  it.each([
    // [Eingabe, erwartete Felder]
    ['2x Hafermilch', { name: 'Hafermilch', quantity: 2 }],
    ['2 × Hafermilch', { name: 'Hafermilch', quantity: 2 }],
    ['500 g Tofu', { name: 'Tofu', quantity: 500, unit: 'g' }],
    ['1,5 l Wasser', { name: 'Wasser', quantity: 1.5, unit: 'l' }],
    ['3 Bananen #reif', { name: 'Bananen', quantity: 3, note: 'reif' }],
    ['Tofu #geräuchert', { name: 'Tofu', note: 'geräuchert' }],
  ])('erkennt „%s"', (input, fields) => {
    expect(parseQuickInput(input)).toEqual(expected(fields));
  });

  it.each([
    // Dezimaltrenner: Komma UND Punkt.
    ['1.5 l Wasser', { name: 'Wasser', quantity: 1.5, unit: 'l' }],
    ['0,5 kg Mehl', { name: 'Mehl', quantity: 0.5, unit: 'kg' }],
    ['1,5x Hafermilch', { name: 'Hafermilch', quantity: 1.5 }],
  ])('akzeptiert Komma und Punkt bei „%s"', (input, fields) => {
    expect(parseQuickInput(input)).toEqual(expected(fields));
  });

  it.each([
    // Einheiten-Normalisierung auf kanonische Kürzel.
    ['500 Gramm Tofu', { name: 'Tofu', quantity: 500, unit: 'g' }],
    ['2 KG Mehl', { name: 'Mehl', quantity: 2, unit: 'kg' }],
    ['1 Liter Wasser', { name: 'Wasser', quantity: 1, unit: 'l' }],
    ['250 ML Sahne', { name: 'Sahne', quantity: 250, unit: 'ml' }],
    ['1 kilo Äpfel', { name: 'Äpfel', quantity: 1, unit: 'kg' }],
  ])('normalisiert die Einheit bei „%s"', (input, fields) => {
    expect(parseQuickInput(input)).toEqual(expected(fields));
  });

  it('kombiniert Menge, Einheit und Notiz', () => {
    expect(parseQuickInput('500 g Tofu #fest')).toEqual(
      expected({ name: 'Tofu', quantity: 500, unit: 'g', note: 'fest' }),
    );
  });

  it('erhält mehrteilige Namen', () => {
    expect(parseQuickInput('2 × Veganer Käse')).toEqual(
      expected({ name: 'Veganer Käse', quantity: 2 }),
    );
  });

  it('bereinigt den Namen (Großschreibung, Mehrfach-Leerzeichen)', () => {
    expect(parseQuickInput('3   bananen')).toEqual(expected({ name: 'Bananen', quantity: 3 }));
  });
});

describe('parseQuickInput – konservativ: Produktnamen mit Zahlen bleiben Name', () => {
  it.each([
    '0% Joghurt',
    '7Up',
    '3-Minuten-Terrine',
    '2xHafermilch', // kein Leerzeichen → mehrdeutig, nicht zerlegen
    'Cola Zero', // reiner Name ohne führende Zahl
    'Hafermilch',
    'Vitamin B12',
  ])('lässt „%s" unzerlegt', (input) => {
    const result = parseQuickInput(input);
    expect(result.quantity).toBeNull();
    expect(result.unit).toBe('');
  });

  it('führende Zahl ohne folgenden Buchstaben wird nicht als Menge gedeutet', () => {
    // „2x4" → Name beginnt nach dem x mit einer Ziffer → kein Multiplikator.
    expect(parseQuickInput('2x4 Holzlatte').quantity).toBeNull();
  });

  it('unbekannte Einheit fällt nicht auf die Einheit-Regel zurück', () => {
    // „Blatt" ist keine erlaubte Einheit → kein unit-Treffer. Die Ganzzahl-Regel
    // greift (bare count), die Einheit bleibt aber leer.
    const result = parseQuickInput('500 Blatt Küchenrolle');
    expect(result.unit).toBe('');
    expect(result.quantity).toBe(500);
    expect(result.name).toBe('Blatt Küchenrolle');
  });

  it('Dezimalzahl ohne Einheit ist keine reine Anzahl', () => {
    // „1,5 Bananen" hat keine Einheit und keinen Multiplikator → nur Ganzzahlen
    // gelten als Anzahl, also bleibt alles Name.
    const result = parseQuickInput('1,5 Bananen');
    expect(result.quantity).toBeNull();
    expect(result.name).toBe('1,5 Bananen');
  });
});

describe('parseQuickInput – Notiz-Trenner', () => {
  it('trennt die Notiz auch ohne Menge ab', () => {
    expect(parseQuickInput('Tofu #geräuchert')).toEqual(
      expected({ name: 'Tofu', note: 'geräuchert' }),
    );
  });

  it('nimmt nur das erste # als Trenner', () => {
    expect(parseQuickInput('Tofu #fest #bio')).toEqual(
      expected({ name: 'Tofu', note: 'fest #bio' }),
    );
  });

  it('leere Notiz nach # ergibt keine Notiz', () => {
    expect(parseQuickInput('Tofu #')).toEqual(expected({ name: 'Tofu' }));
  });

  it('nur eine Notiz ohne Name → alles bleibt Name (Fallback)', () => {
    expect(parseQuickInput('#reif')).toEqual(expected({ name: '#reif' }));
  });
});

describe('parseQuickInput – Randfälle', () => {
  it.each([
    ['', ''],
    ['   ', ''],
  ])('leere/blanke Eingabe „%s" → leerer Name', (input, name) => {
    expect(parseQuickInput(input)).toEqual(expected({ name }));
  });

  it('nicht-String-Eingabe ergibt einen leeren Namen', () => {
    expect(parseQuickInput(undefined)).toEqual(expected({ name: '' }));
    expect(parseQuickInput(null)).toEqual(expected({ name: '' }));
    expect(parseQuickInput(42)).toEqual(expected({ name: '' }));
  });

  it('Menge 0 wird nicht als gültige Menge übernommen', () => {
    // „0 x Tofu" → coerceQuantity(0) = null; bleibt aber ohne Multiplikator/Menge.
    expect(parseQuickInput('0 x Tofu').quantity).toBeNull();
  });
});

describe('QUICK_UNIT_ALIASES', () => {
  it('bildet Aliase auf kanonische Kürzel ab', () => {
    expect(QUICK_UNIT_ALIASES.gramm).toBe('g');
    expect(QUICK_UNIT_ALIASES.liter).toBe('l');
    expect(QUICK_UNIT_ALIASES.kilogramm).toBe('kg');
  });
});
