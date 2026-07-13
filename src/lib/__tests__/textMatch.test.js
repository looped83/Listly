import { describe, expect, it } from 'vitest';
import {
  FUZZY_MIN_LENGTH,
  MATCH,
  compactText,
  describeText,
  fuzzyThreshold,
  matchTier,
  normalizeText,
  stemDe,
  substringEditDistance,
  synonymTargets,
  tokenize,
} from '../textMatch';

describe('normalizeText', () => {
  const cases = [
    ['leerer/nicht-String', undefined, ''],
    ['Kleinschreibung', 'ApFeL', 'apfel'],
    ['ß → ss', 'Weiße', 'weisse'],
    ['Umlaut ä → a', 'Äpfel', 'apfel'],
    ['ASCII-Umlaut ae → a', 'Aepfel', 'apfel'],
    ['plain a bleibt a', 'Apfel', 'apfel'],
    ['ö/ü', 'Grüße Möhren', 'grusse mohren'],
    ['ue-Ersatz', 'Muesli', 'musli'],
    ['echte Umlaut-Form', 'Müsli', 'musli'],
    ['diakritisch (é, ñ)', 'Jalapeño Café', 'jalapeno cafe'],
    ['Whitespace normalisiert', '  Rote   Bete  ', 'rote bete'],
  ];
  it.each(cases)('%s', (_label, input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });

  it('macht ä ≡ a ≡ ae identisch', () => {
    const forms = ['Käse', 'Kaese', 'kase'].map(normalizeText);
    expect(new Set(forms).size).toBe(1);
    expect(forms[0]).toBe('kase');
  });
});

describe('tokenize / compactText', () => {
  it('zerlegt an Nicht-Alphanumerik', () => {
    expect(tokenize('krauter-aufstrich natur')).toEqual(['krauter', 'aufstrich', 'natur']);
  });
  it('kompaktiert zu einer Zeichenkette', () => {
    expect(compactText('hafer milch-barista')).toBe('hafermilchbarista');
  });
});

describe('stemDe (konservativer Plural-Stemmer)', () => {
  const cases = [
    ['Karotten', 'karotte'],
    ['Karotte', 'karotte'],
    ['Zwiebeln', 'zwiebel'],
    ['Bohnen', 'bohne'],
    ['Chips', 'chip'],
    ['Reis', 'reis'], // zu kurz → unverändert
    ['Kase', 'kase'], // endet nicht auf n/s
  ];
  it.each(cases)('%s → %s', (input, expected) => {
    expect(stemDe(normalizeText(input))).toBe(expected);
  });

  it('Singular und Plural konvergieren auf denselben Stamm', () => {
    expect(stemDe('karotten')).toBe(stemDe('karotte'));
    expect(stemDe('zwiebeln')).toBe(stemDe('zwiebel'));
  });
});

describe('substringEditDistance', () => {
  it('ist 0 bei enthaltenem Teilstring', () => {
    expect(substringEditDistance('milch', 'hafermilch')).toBe(0);
  });
  it('zählt einen Tippfehler als Distanz 1', () => {
    expect(substringEditDistance('banene', 'banane')).toBe(1);
  });
  it('leere Nadel → 0', () => {
    expect(substringEditDistance('', 'apfel')).toBe(0);
  });
});

describe('synonymTargets', () => {
  it('bildet englische Begriffe auf deutsche Ziele ab', () => {
    expect([...synonymTargets(normalizeText('oat milk'))]).toEqual(['hafermilch']);
    expect([...synonymTargets(normalizeText('chickpeas'))]).toEqual(['kichererbsen']);
  });
  it('liefert für Unbekanntes ein leeres Set', () => {
    expect(synonymTargets(normalizeText('xyz')).size).toBe(0);
  });
});

describe('matchTier (deterministische Stufen)', () => {
  const tier = (q, name) => matchTier(normalizeText(q), describeText(name));

  const cases = [
    ['exakt', 'apfel', 'Apfel', MATCH.EXACT],
    ['Präfix ganzer Name', 'apf', 'Apfel', MATCH.PREFIX],
    ['Präfix mehrwortig', 'gruner a', 'Grüner Apfel', MATCH.PREFIX],
    ['Token-Präfix (zweites Wort)', 'butter', 'Vegane Butter', MATCH.TOKEN_PREFIX],
    ['Token-Präfix mehrere Tokens', 'veg but', 'Vegane Butter', MATCH.TOKEN_PREFIX],
    ['Teilstring im Kompositum', 'milch', 'Hafermilch', MATCH.SUBSTRING],
    ['Teilstring mit Leerzeichen-Kompakt', 'hafermilch', 'Hafer Milch', MATCH.SUBSTRING],
    ['Singular/Plural', 'karotten', 'Karotte', MATCH.STEM],
    ['kein Treffer', 'zzz', 'Apfel', MATCH.NONE],
  ];
  it.each(cases)('%s', (_label, q, name, expected) => {
    expect(tier(q, name)).toBe(expected);
  });

  it('Umlaut-Varianten treffen exakt', () => {
    expect(tier('kaese', 'Käse')).toBe(MATCH.EXACT);
    expect(tier('kase', 'Käse')).toBe(MATCH.EXACT);
  });
});

describe('fuzzyThreshold / FUZZY_MIN_LENGTH', () => {
  it('ist streng: 1, bei langer Eingabe (≥ 8) höchstens 2', () => {
    expect(fuzzyThreshold(4)).toBe(1);
    expect(fuzzyThreshold(7)).toBe(1);
    expect(fuzzyThreshold(8)).toBe(2);
  });
  it('Mindestlänge ist ausreichend groß', () => {
    expect(FUZZY_MIN_LENGTH).toBeGreaterThanOrEqual(4);
  });
});
