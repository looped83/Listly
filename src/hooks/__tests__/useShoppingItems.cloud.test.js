import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useShoppingItems } from '../useShoppingItems';
import { LIST_ID } from '../../lib/supabase';
import { STORAGE_KEYS } from '../../lib/storage';

/**
 * Cloud-Modus mit gemocktem Supabase-Client: prüft, welche Zeilen die
 * Hintergrund-Schreiboperationen tatsächlich an die Datenbank senden –
 * insbesondere, dass die Undo-Wiederherstellung (restoreItems) die optionalen
 * Feld quantity NICHT verliert – sowie Laden, Cache und Abgleich.
 *
 * Der Mock hält eine kleine Fake-Tabelle (`db.rows`), sodass ein erneutes
 * Laden (Refetch) den tatsächlichen Stand nach den Schreiboperationen liefert.
 */
const mocks = vi.hoisted(() => {
  const calls = { inserts: [], updates: [], deletes: [], selects: 0 };
  // selectQueue: optionale, der Reihe nach verbrauchte Antworten für select
  // (z. B. verzögerte Promises); leer → aktueller Tabelleninhalt.
  const db = { rows: [], selectQueue: [], onState: null };
  const channel = {
    on: () => channel,
    subscribe: (onState) => {
      db.onState = onState;
      onState?.('SUBSCRIBED');
      return channel;
    },
  };
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => {
            calls.selects += 1;
            const queued = db.selectQueue.shift();
            return queued ?? Promise.resolve({ data: [...db.rows], error: null });
          },
        }),
      }),
      insert: (rows) => {
        calls.inserts.push(rows);
        db.rows.push(...[].concat(rows));
        return Promise.resolve({ error: null });
      },
      update: (patch) => ({
        eq: (_column, id) => {
          calls.updates.push({ patch, id });
          db.rows = db.rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
          return Promise.resolve({ error: null });
        },
      }),
      delete: () => ({
        eq: (_column, id) => {
          calls.deletes.push([id]);
          db.rows = db.rows.filter((row) => row.id !== id);
          return Promise.resolve({ error: null });
        },
        in: (_column, ids) => {
          calls.deletes.push(ids);
          db.rows = db.rows.filter((row) => !ids.includes(row.id));
          return Promise.resolve({ error: null });
        },
      }),
    }),
    channel: () => channel,
    removeChannel: () => {},
  };
  const getSupabase = vi.fn(() => Promise.resolve(supabase));
  return { calls, db, supabase, getSupabase };
});

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCloudEnabled: true,
    getSupabase: mocks.getSupabase,
  };
});

const row = (id, name, extra = {}) => ({
  id,
  list_id: LIST_ID,
  name,
  category: null,
  checked: false,
  created_at: `2026-07-01T10:00:0${id.length % 10}.000Z`,
  ...extra,
});

const cacheList = (listId, items) =>
  localStorage.setItem(STORAGE_KEYS.cloudItems, JSON.stringify({ listId, items }));

/** Promise, das sich von außen auflösen lässt (für Antwort-Reihenfolgen). */
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.calls.inserts.length = 0;
  mocks.calls.updates.length = 0;
  mocks.calls.deletes.length = 0;
  mocks.calls.selects = 0;
  mocks.db.rows = [];
  mocks.db.selectQueue = [];
  mocks.db.onState = null;
  mocks.getSupabase.mockImplementation(() => Promise.resolve(mocks.supabase));
  localStorage.clear();
});

describe('useShoppingItems – Cloud-Schreiboperationen', () => {
  it('sendet beim Anlegen alle gesetzten Felder (inkl. quantity)', async () => {
    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('live'));

    act(() => {
      result.current.addItem('Tofu', 'proteine', { quantity: 3 });
    });

    await waitFor(() => expect(mocks.calls.inserts).toHaveLength(1));
    expect(mocks.calls.inserts[0]).toMatchObject({
      list_id: LIST_ID,
      name: 'Tofu',
      category: 'proteine',
      checked: false,
      quantity: 3,
    });
    expect('unit' in mocks.calls.inserts[0]).toBe(false);
    expect('note' in mocks.calls.inserts[0]).toBe(false);
    expect(mocks.calls.inserts[0].created_at).toBeTruthy();
  });

  it('stellt bei restoreItems (Undo) die Menge und checked verlustfrei wieder her', async () => {
    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('live'));

    const removedItem = {
      id: 'id-restore-1',
      name: 'Hafermilch',
      category: 'milchalternativen',
      checked: true,
      createdAt: '2026-07-01T10:00:00.000Z',
      quantity: 2,
    };
    act(() => {
      result.current.restoreItems([removedItem]);
    });

    await waitFor(() => expect(mocks.calls.inserts).toHaveLength(1));
    expect(mocks.calls.inserts[0]).toEqual([
      {
        id: 'id-restore-1',
        list_id: LIST_ID,
        name: 'Hafermilch',
        category: 'milchalternativen',
        checked: true,
        created_at: '2026-07-01T10:00:00.000Z',
        quantity: 2,
      },
    ]);
    // Auch lokal vollständig wiederhergestellt.
    expect(result.current.items[0]).toMatchObject({ quantity: 2 });
  });

  it('löscht beim Einkaufsabschluss genau die verbuchten Artikel in der Cloud', async () => {
    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('live'));

    act(() => {
      result.current.addItem('Apfel');
      result.current.addItem('Banane');
    });
    const appleId = result.current.items.find((it) => it.name === 'Apfel').id;
    act(() => {
      result.current.toggleItem(appleId, true);
    });

    let completed;
    act(() => {
      completed = result.current.completeCheckout();
    });

    expect(completed.map((it) => it.name)).toEqual(['Apfel']);
    await waitFor(() => expect(mocks.calls.deletes).toContainEqual([appleId]));
    expect(result.current.items.map((it) => it.name)).toEqual(['Banane']);
  });

  it('setzt bei einem Verbindungsfehler den Status auf "error" statt eine Rejection zu hinterlassen', async () => {
    mocks.getSupabase.mockImplementation(() => Promise.reject(new Error('offline')));

    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('error'));
    // Ohne Cache ist die Liste dann „nicht ladbar“, nicht „leer“.
    expect(result.current.loadState).toBe('offline');
    expect(result.current.items).toEqual([]);
  });
});

describe('useShoppingItems – Laden, Cache und Abgleich', () => {
  it('zeigt beim Start sofort den zuletzt gecachten Stand und gleicht dann ab', async () => {
    cacheList(LIST_ID, [{ id: 'c1', name: 'Tofu', category: null, checked: false }]);
    mocks.db.rows = [row('s1', 'Hafermilch')];

    const { result } = renderHook(() => useShoppingItems());
    // Vor jeder Serverantwort: gecachter Stand, bereits nutzbar.
    expect(result.current.items.map((it) => it.name)).toEqual(['Tofu']);
    expect(result.current.loadState).toBe('ready');
    expect(result.current.status).toBe('connecting');

    await waitFor(() =>
      expect(result.current.items.map((it) => it.name)).toEqual(['Hafermilch']),
    );
    expect(result.current.status).toBe('live');
  });

  it('ignoriert den Cache einer anderen Liste (LIST_ID geändert)', () => {
    cacheList('eine-andere-liste', [{ id: 'c1', name: 'Tofu', checked: false }]);
    mocks.getSupabase.mockImplementation(() => new Promise(() => {})); // lädt noch

    const { result } = renderHook(() => useShoppingItems());
    expect(result.current.items).toEqual([]);
    expect(result.current.loadState).toBe('loading');
  });

  it('cacht den Server-Stand für den nächsten Start', async () => {
    mocks.db.rows = [row('s1', 'Hafermilch', { quantity: 2 })];

    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.cloudItems));
    expect(cached.listId).toBe(LIST_ID);
    expect(cached.items).toEqual([
      expect.objectContaining({ id: 's1', name: 'Hafermilch', quantity: 2 }),
    ]);
  });

  it('bleibt beim Laden, solange nur Realtime scheitert und die Abfrage noch läuft', async () => {
    mocks.db.selectQueue.push(new Promise(() => {})); // Abfrage hängt (langsames Netz)
    const originalChannel = mocks.supabase.channel;
    mocks.supabase.channel = () => ({
      on() {
        return this;
      },
      subscribe(onState) {
        onState('CHANNEL_ERROR');
        return this;
      },
    });

    try {
      const { result } = renderHook(() => useShoppingItems());
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.loadState).toBe('loading');
    } finally {
      mocks.supabase.channel = originalChannel;
    }
  });

  it('behält offline einen gecachten Stand (statt „Keine Verbindung“)', async () => {
    cacheList(LIST_ID, [{ id: 'c1', name: 'Tofu', category: null, checked: false }]);
    mocks.getSupabase.mockImplementation(() => Promise.reject(new Error('offline')));

    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.loadState).toBe('ready');
    expect(result.current.items.map((it) => it.name)).toEqual(['Tofu']);
  });

  it('cacht nichts, solange noch kein Stand vorliegt', async () => {
    mocks.getSupabase.mockImplementation(() => Promise.reject(new Error('offline')));

    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(localStorage.getItem(STORAGE_KEYS.cloudItems)).toBeNull();
  });

  it('gleicht nach einem erneuten Abo (Reconnect) verpasste Änderungen ab', async () => {
    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('live'));

    // Während der Verbindung weg war, hat das andere Gerät etwas hinzugefügt.
    mocks.db.rows.push(row('s2', 'Brokkoli'));
    act(() => mocks.db.onState('SUBSCRIBED'));

    await waitFor(() =>
      expect(result.current.items.map((it) => it.name)).toEqual(['Brokkoli']),
    );
  });

  it('gleicht bei Rückkehr in die App und bei „online“ ab', async () => {
    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('live'));

    mocks.db.rows.push(row('s2', 'Brokkoli'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() =>
      expect(result.current.items.map((it) => it.name)).toEqual(['Brokkoli']),
    );

    mocks.db.rows.push(row('s3', 'Spinat'));
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() =>
      expect(result.current.items.map((it) => it.name)).toEqual(['Brokkoli', 'Spinat']),
    );
  });

  it('räumt die Abgleich-Listener beim Unmount ab', async () => {
    const { result, unmount } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('live'));
    const selectsBefore = mocks.calls.selects;

    unmount();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));

    expect(mocks.calls.selects).toBe(selectsBefore);
  });

  it('lässt eine verspätete ältere Antwort keinen neueren Stand überschreiben', async () => {
    // 1. Abfrage (Start) antwortet erst spät mit einem veralteten Stand,
    // 2. Abfrage (nach dem Abo) sofort mit dem aktuellen.
    const slow = deferred();
    mocks.db.selectQueue.push(slow.promise);
    mocks.db.rows = [row('s2', 'Aktuell')];

    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() =>
      expect(result.current.items.map((it) => it.name)).toEqual(['Aktuell']),
    );

    await act(async () => {
      slow.resolve({ data: [row('s1', 'Veraltet')], error: null });
      await slow.promise;
    });
    expect(result.current.items.map((it) => it.name)).toEqual(['Aktuell']);
  });
});
