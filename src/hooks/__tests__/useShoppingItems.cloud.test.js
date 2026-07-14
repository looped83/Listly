import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useShoppingItems } from '../useShoppingItems';
import { LIST_ID } from '../../lib/supabase';

/**
 * Cloud-Modus mit gemocktem Supabase-Client: prüft, welche Zeilen die
 * Hintergrund-Schreiboperationen tatsächlich an die Datenbank senden –
 * insbesondere, dass die Undo-Wiederherstellung (restoreItems) die optionalen
 * Felder quantity/unit/note NICHT verliert.
 */
const mocks = vi.hoisted(() => {
  const calls = { inserts: [], updates: [], deletes: [] };
  const channel = {
    on: () => channel,
    subscribe: (onState) => {
      onState?.('SUBSCRIBED');
      return channel;
    },
  };
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      }),
      insert: (rows) => {
        calls.inserts.push(rows);
        return Promise.resolve({ error: null });
      },
      update: (patch) => ({
        eq: (_column, id) => {
          calls.updates.push({ patch, id });
          return Promise.resolve({ error: null });
        },
      }),
      delete: () => ({
        eq: (_column, id) => {
          calls.deletes.push([id]);
          return Promise.resolve({ error: null });
        },
        in: (_column, ids) => {
          calls.deletes.push(ids);
          return Promise.resolve({ error: null });
        },
      }),
    }),
    channel: () => channel,
    removeChannel: () => {},
  };
  const getSupabase = vi.fn(() => Promise.resolve(supabase));
  return { calls, supabase, getSupabase };
});

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCloudEnabled: true,
    getSupabase: mocks.getSupabase,
  };
});

beforeEach(() => {
  mocks.calls.inserts.length = 0;
  mocks.calls.updates.length = 0;
  mocks.calls.deletes.length = 0;
  mocks.getSupabase.mockImplementation(() => Promise.resolve(mocks.supabase));
});

describe('useShoppingItems – Cloud-Schreiboperationen', () => {
  it('sendet beim Anlegen alle gesetzten Felder (inkl. quantity/unit/note)', async () => {
    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('live'));

    act(() => {
      result.current.addItem('Tofu', 'proteine', { quantity: 500, unit: 'g', note: 'fest' });
    });

    await waitFor(() => expect(mocks.calls.inserts).toHaveLength(1));
    expect(mocks.calls.inserts[0]).toMatchObject({
      list_id: LIST_ID,
      name: 'Tofu',
      category: 'proteine',
      checked: false,
      quantity: 500,
      unit: 'g',
      note: 'fest',
    });
    expect(mocks.calls.inserts[0].created_at).toBeTruthy();
  });

  it('stellt bei restoreItems (Undo) quantity/unit/note und checked verlustfrei wieder her', async () => {
    const { result } = renderHook(() => useShoppingItems());
    await waitFor(() => expect(result.current.status).toBe('live'));

    const removedItem = {
      id: 'id-restore-1',
      name: 'Hafermilch',
      category: 'milchalternativen',
      checked: true,
      createdAt: '2026-07-01T10:00:00.000Z',
      quantity: 2,
      unit: 'l',
      note: 'ungesüßt',
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
        unit: 'l',
        note: 'ungesüßt',
      },
    ]);
    // Auch lokal vollständig wiederhergestellt.
    expect(result.current.items[0]).toMatchObject({ quantity: 2, unit: 'l', note: 'ungesüßt' });
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
  });
});
