import { describe, expect, it } from 'vitest';
import { itemsToComplete, summarizeCheckout } from '../checkout';

const make = (checked) => ({ id: `id-${Math.random()}`, name: 'x', checked });

describe('summarizeCheckout', () => {
  it('zählt abgehakte und offene Artikel', () => {
    const items = [make(true), make(false), make(true), make(false), make(false)];
    expect(summarizeCheckout(items)).toEqual({ checkedCount: 2, openCount: 3, total: 5 });
  });

  it('behandelt fehlendes checked-Feld als offen', () => {
    const items = [{ id: 'a', name: 'a' }, { id: 'b', name: 'b', checked: true }];
    expect(summarizeCheckout(items)).toEqual({ checkedCount: 1, openCount: 1, total: 2 });
  });

  it('liefert Nullwerte für eine leere Liste', () => {
    expect(summarizeCheckout([])).toEqual({ checkedCount: 0, openCount: 0, total: 0 });
  });
});

describe('itemsToComplete', () => {
  it('wählt standardmäßig nur abgehakte Artikel', () => {
    const a = make(true);
    const b = make(false);
    const c = make(true);
    expect(itemsToComplete([a, b, c])).toEqual([a, c]);
  });

  it('wählt mit includeOpen alle Artikel', () => {
    const items = [make(true), make(false)];
    expect(itemsToComplete(items, true)).toEqual(items);
  });

  it('mutiert die Eingabe nicht (gibt bei includeOpen eine Kopie zurück)', () => {
    const items = [make(true), make(false)];
    const result = itemsToComplete(items, true);
    expect(result).not.toBe(items);
    expect(result).toEqual(items);
  });
});
