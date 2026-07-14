import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useShoppingItems } from '../useShoppingItems';

// Lokaler Modus erzwingen: keine echten Netzwerkaufrufe, deterministisches Verhalten.
vi.mock('../../lib/supabase', () => ({
  isCloudEnabled: false,
  getSupabase: () => Promise.resolve(null),
  rowToItem: (row) => row,
  itemToRow: (item) => item,
  TABLE: 'list_items',
  LIST_ID: 'test-list',
}));

function createLocalStorageMock() {
  let store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
});

/**
 * addItem ist die zentrale Dubletten-Logik, unabhängig davon, ob der Aufruf
 * aus manueller Eingabe, Autovervollständigung oder Chips stammt – alle drei
 * Quellen rufen in der App am Ende denselben Hook-Callback auf. Diese Tests
 * decken den Vertrag direkt am Hook ab: eindeutiges Ergebnisobjekt statt
 * stillem Verhalten, keine Dubletten im Speicher, Groß-/Kleinschreibungs- und
 * Leerzeichen-Toleranz bei der Erkennung.
 */
describe('useShoppingItems – addItem Ergebnis-Status', () => {
  it('legt einen neuen Artikel an und liefert status "added"', () => {
    const { result } = renderHook(() => useShoppingItems());

    let outcome;
    act(() => {
      outcome = result.current.addItem('Hafermilch');
    });

    expect(outcome.status).toBe('added');
    expect(outcome.item).toMatchObject({ name: 'Hafermilch', checked: false });
    expect(result.current.items).toHaveLength(1);
  });

  it('erkennt einen bereits offenen Artikel (case-/whitespace-insensitiv) als Dublette', () => {
    const { result } = renderHook(() => useShoppingItems());

    act(() => {
      result.current.addItem('Hafermilch');
    });

    let outcome;
    act(() => {
      outcome = result.current.addItem('  HAFERMILCH  ');
    });

    expect(outcome.status).toBe('alreadyOpen');
    expect(outcome.item).toMatchObject({ name: 'Hafermilch' });
    // Keine Dublette im Speicher.
    expect(result.current.items).toHaveLength(1);
  });

  it('reaktiviert einen bereits erledigten Artikel statt eine Dublette anzulegen', () => {
    const { result } = renderHook(() => useShoppingItems());

    act(() => {
      result.current.addItem('Hafermilch');
    });
    const id = result.current.items[0].id;
    act(() => {
      result.current.toggleItem(id, true);
    });
    expect(result.current.items[0].checked).toBe(true);

    let outcome;
    act(() => {
      outcome = result.current.addItem('hafermilch');
    });

    expect(outcome.status).toBe('reactivated');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ id, checked: false });
  });

  it('liefert status "invalid" für einen leeren/blanken Namen und legt nichts an', () => {
    const { result } = renderHook(() => useShoppingItems());

    let outcome;
    act(() => {
      outcome = result.current.addItem('   ');
    });

    expect(outcome.status).toBe('invalid');
    expect(result.current.items).toHaveLength(0);
  });

  it('übernimmt die Menge (ab 2) aus dem Hinzufügen-Sheet an einem neuen Artikel', () => {
    const { result } = renderHook(() => useShoppingItems());

    let outcome;
    act(() => {
      outcome = result.current.addItem('Tofu', undefined, { quantity: 3 });
    });

    expect(outcome.status).toBe('added');
    expect(outcome.item).toMatchObject({ name: 'Tofu', quantity: 3 });
    expect(result.current.items[0]).toMatchObject({ quantity: 3 });
  });

  it('materialisiert die Standardmenge 1 (und leere Extras) nicht (omit-empty)', () => {
    const { result } = renderHook(() => useShoppingItems());

    act(() => {
      result.current.addItem('Apfel', undefined, { quantity: 1 });
    });

    const item = result.current.items[0];
    expect('quantity' in item).toBe(false);
  });

  it('Dublettenerkennung läuft über den Namen – auch mit Mengen-Extras', () => {
    const { result } = renderHook(() => useShoppingItems());

    act(() => {
      result.current.addItem('Hafermilch');
    });

    let outcome;
    act(() => {
      outcome = result.current.addItem('Hafermilch', undefined, { quantity: 2 });
    });

    expect(outcome.status).toBe('alreadyOpen');
    expect(result.current.items).toHaveLength(1);
    // Vorhandener Artikel wird NICHT mit der neuen Menge überschrieben.
    expect('quantity' in result.current.items[0]).toBe(false);
  });

  it('liest bei jedem Aufruf den aktuellen Stand (keine stale Closure über mehrere Renders)', () => {
    const { result } = renderHook(() => useShoppingItems());

    act(() => {
      result.current.addItem('Apfel');
    });
    act(() => {
      result.current.addItem('Banane');
    });

    let outcome;
    act(() => {
      // Nach zwei vorherigen, committeten Hinzufügungen: Dublettenprüfung muss
      // den aktuellen Stand sehen, nicht den aus der ersten Render-Closure.
      outcome = result.current.addItem('apfel');
    });

    expect(outcome.status).toBe('alreadyOpen');
    expect(result.current.items).toHaveLength(2);
  });
});
