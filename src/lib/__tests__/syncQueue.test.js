import { describe, expect, it } from 'vitest';
import { applyOp, applyOps, isRetryable, mergeOps, sanitizeOps } from '../syncQueue';

const item = (id, name, extra = {}) => ({
  id,
  name,
  category: null,
  checked: false,
  createdAt: `2026-07-0${id}`,
  ...extra,
});

describe('syncQueue – Operationen lokal anwenden', () => {
  const base = [item('1', 'Tofu'), item('3', 'Spinat')];

  it('upsert fügt neue Artikel sortiert ein und ersetzt vorhandene', () => {
    const next = applyOp(base, {
      opId: 'a',
      type: 'upsert',
      items: [item('2', 'Brokkoli'), item('3', 'Spinat', { checked: true })],
    });
    expect(next.map((it) => it.name)).toEqual(['Tofu', 'Brokkoli', 'Spinat']);
    expect(next[2].checked).toBe(true);
  });

  it('update ändert nur die Felder des betroffenen Artikels', () => {
    const next = applyOp(base, { opId: 'a', type: 'update', itemId: '1', patch: { checked: true } });
    expect(next[0]).toEqual({ ...base[0], checked: true });
    expect(next[1]).toBe(base[1]);
  });

  it('delete entfernt die angegebenen Artikel', () => {
    const next = applyOp(base, { opId: 'a', type: 'delete', itemIds: ['1'] });
    expect(next.map((it) => it.name)).toEqual(['Spinat']);
  });

  it('ist idempotent: doppeltes Anwenden ergibt dasselbe Ergebnis', () => {
    const ops = [
      { opId: 'a', type: 'upsert', items: [item('2', 'Brokkoli')] },
      { opId: 'b', type: 'update', itemId: '2', patch: { checked: true } },
      { opId: 'c', type: 'delete', itemIds: ['1'] },
    ];
    const once = applyOps(base, ops);
    expect(applyOps(once, ops)).toEqual(once);
  });

  it('verändert die Eingabe nicht (pure)', () => {
    const snapshot = JSON.stringify(base);
    applyOps(base, [
      { opId: 'a', type: 'upsert', items: [item('2', 'Brokkoli')] },
      { opId: 'b', type: 'delete', itemIds: ['3'] },
    ]);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe('syncQueue – Hilfsfunktionen', () => {
  it('mergeOps vereinigt nach opId und behält die Reihenfolge', () => {
    const a = { opId: 'a' };
    const b = { opId: 'b' };
    const c = { opId: 'c' };
    expect(mergeOps([a, b], [b, c])).toEqual([a, b, c]);
  });

  it.each([
    [0, true],
    [undefined, true],
    [503, true],
    [408, true],
    [429, true],
    [400, false],
    [403, false],
    [409, false],
  ])('isRetryable(status %s) → %s', (status, expected) => {
    expect(isRetryable({ status })).toBe(expected);
  });

  it('sanitizeOps verwirft Unbekanntes und Unvollständiges', () => {
    const valid = [
      { opId: 'a', type: 'upsert', items: [] },
      { opId: 'b', type: 'update', itemId: 'x', patch: { checked: true } },
      { opId: 'c', type: 'delete', itemIds: ['x'] },
    ];
    const invalid = [
      null,
      'kaputt',
      { opId: 'd', type: 'drop' },
      { type: 'delete', itemIds: [] },
      { opId: 'e', type: 'upsert' },
      { opId: 'f', type: 'update', patch: {} },
      { opId: 'g', type: 'delete' },
    ];
    expect(sanitizeOps([...valid, ...invalid])).toEqual(valid);
    expect(sanitizeOps('kein Array')).toEqual([]);
  });
});
