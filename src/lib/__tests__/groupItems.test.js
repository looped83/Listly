import { describe, expect, it } from 'vitest';
import { groupByCategory } from '../groupItems';

const item = (name, category) => ({ id: name, name, category, checked: false });

describe('groupByCategory', () => {
  it('liefert eine leere Liste für keine Artikel', () => {
    expect(groupByCategory([])).toEqual([]);
  });

  it('gruppiert bekannte Kategorien in Katalog-Reihenfolge, nicht Eingabereihenfolge', () => {
    const items = [item('Hafermilch', 'milchalternativen'), item('Apfel', 'obst-gemuese')];

    const groups = groupByCategory(items);

    expect(groups.map((g) => g.category.id)).toEqual(['obst-gemuese', 'milchalternativen']);
    expect(groups.map((g) => g.category.name)).toEqual(['Obst & Gemüse', 'Milchalternativen']);
  });

  it('lässt Kategorien ohne Artikel aus', () => {
    const groups = groupByCategory([item('Apfel', 'obst-gemuese')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].category.id).toBe('obst-gemuese');
  });

  it('fasst eine unbekannte Kategorie in „Sonstiges“ zusammen, zuletzt', () => {
    const items = [item('Mystery', 'nicht-existent'), item('Apfel', 'obst-gemuese')];

    const groups = groupByCategory(items);

    expect(groups.map((g) => g.category.name)).toEqual(['Obst & Gemüse', 'Sonstiges']);
    expect(groups[1].items.map((i) => i.name)).toEqual(['Mystery']);
  });

  it('fasst eine fehlende Kategorie (null/undefined) ebenfalls unter „Sonstiges“ zusammen', () => {
    const items = [item('Apfel', 'obst-gemuese'), item('Null-Kategorie', null), item('Ohne-Feld')];

    const groups = groupByCategory(items);

    expect(groups.map((g) => g.category.name)).toEqual(['Obst & Gemüse', 'Sonstiges']);
    expect(groups[1].items.map((i) => i.name)).toEqual(['Null-Kategorie', 'Ohne-Feld']);
  });

  it('bündelt unbekannte UND fehlende Kategorien in EINER einzigen „Sonstiges“-Gruppe', () => {
    // Regressionstest: unterschiedliche „falsy"/unbekannte Kategorie-Werte
    // dürfen keine zwei separaten Sonstiges-Gruppen erzeugen.
    const items = [
      item('A', 'nicht-existent'),
      item('B', null),
      item('C', undefined),
      item('D', ''),
      item('E', 'auch-nicht-existent'),
    ];

    const groups = groupByCategory(items);

    expect(groups).toHaveLength(1);
    expect(groups[0].category.id).toBe('__other');
    expect(groups[0].items.map((i) => i.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('behält die Eingabereihenfolge innerhalb einer Kategorie bei (stabil)', () => {
    const items = [
      item('Banane', 'obst-gemuese'),
      item('Apfel', 'obst-gemuese'),
      item('Birne', 'obst-gemuese'),
    ];

    const groups = groupByCategory(items);

    expect(groups[0].items.map((i) => i.name)).toEqual(['Banane', 'Apfel', 'Birne']);
  });

  it('gemischte Kategorien: mehrere bekannte Gruppen + Sonstiges, korrekt sortiert und befüllt', () => {
    const items = [
      item('Erbsen', 'tiefkuehl'),
      item('Apfel', 'obst-gemuese'),
      item('Mystery', 'foo'),
      item('Hafermilch', 'milchalternativen'),
      item('Banane', 'obst-gemuese'),
    ];

    const groups = groupByCategory(items);

    expect(groups.map((g) => g.category.id)).toEqual([
      'obst-gemuese',
      'milchalternativen',
      'tiefkuehl',
      '__other',
    ]);
    expect(groups.find((g) => g.category.id === 'obst-gemuese').items.map((i) => i.name)).toEqual([
      'Apfel',
      'Banane',
    ]);
    expect(groups.find((g) => g.category.id === '__other').items.map((i) => i.name)).toEqual([
      'Mystery',
    ]);
  });

  it('gibt für jede Gruppe die Anzahl der enthaltenen Artikel her (items.length)', () => {
    const items = [
      item('Apfel', 'obst-gemuese'),
      item('Banane', 'obst-gemuese'),
      item('Hafermilch', 'milchalternativen'),
    ];

    const groups = groupByCategory(items);

    expect(groups.find((g) => g.category.id === 'obst-gemuese').items).toHaveLength(2);
    expect(groups.find((g) => g.category.id === 'milchalternativen').items).toHaveLength(1);
  });
});
