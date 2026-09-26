import { describe, expect, it } from 'vitest';
import { DEFAULT_EMOJI, getItemEmoji, getKnownCategory } from '../icons';

describe('getKnownCategory – Katalog-Abgleich', () => {
  it.each([
    ['Hafermilch', 'milchalternativen'], // exakt
    ['hafermilch ', 'milchalternativen'], // Groß-/Kleinschreibung, Leerzeichen
    ['Bananen', 'obst-gemuese'], // Plural → Banane
    ['Zwiebeln', 'obst-gemuese'], // Plural → Zwiebel
    ['Äpfel', 'obst-gemuese'], // Umlaut → Apfel
    ['Tomate', 'obst-gemuese'], // Singular → Tomaten
    ['Muesli', 'muesli'], // Ersatzschreibweise → Müsli
  ])('„%s“ → %s', (name, category) => {
    expect(getKnownCategory(name)).toBe(category);
  });

  it.each([
    ['Brot', 'brot-backwaren'], // Vollkornbrot, Dinkelbrot …
    ['Tofu', 'proteine'], // Tofu natur, Räuchertofu, Seidentofu
    ['Nüsse', 'nuesse-kerne'], // Walnüsse, Haselnüsse …
    ['Kohl', 'obst-gemuese'], // Mehrheit: Blumenkohl, Rosenkohl … (nicht Rotkohl (Glas))
  ])('erkennt das Grundwort „%s“ → %s', (name, category) => {
    expect(getKnownCategory(name)).toBe(category);
  });

  it.each(['Butter', 'Bohnen', 'Kräuter'])(
    'lässt das mehrdeutige Grundwort „%s“ ohne Kategorie',
    (name) => {
      expect(getKnownCategory(name)).toBeNull();
    },
  );

  it('rät bei sehr kurzen oder unbekannten Wörtern nicht', () => {
    expect(getKnownCategory('Öl')).toBeNull();
    expect(getKnownCategory('Klopapier')).toBeNull();
    expect(getKnownCategory('')).toBeNull();
  });
});

describe('getItemEmoji', () => {
  it('nutzt das Produkt-Emoji auch bei Plural/Umlaut', () => {
    expect(getItemEmoji('Bananen', null)).toBe(getItemEmoji('Banane', null));
    expect(getItemEmoji('Bananen', null)).not.toBe(DEFAULT_EMOJI);
  });

  it('fällt ohne Produkt auf das Emoji der (gespeicherten) Kategorie zurück', () => {
    expect(getItemEmoji('Irgendwas', 'getraenke')).toBe('🥤');
  });

  it('nutzt ohne gespeicherte Kategorie das eindeutige Grundwort', () => {
    expect(getItemEmoji('Brot', null)).toBe('🍞');
  });

  it('zeigt sonst das Standard-Emoji', () => {
    expect(getItemEmoji('Klopapier', null)).toBe(DEFAULT_EMOJI);
  });
});
