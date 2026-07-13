import { useCallback, useEffect, useRef, useState } from 'react';
import { isCloudEnabled, getSupabase, rowToItem, TABLE, LIST_ID } from '../lib/supabase';
import { readStorage, writeStorage, STORAGE_KEYS } from '../lib/storage';
import { cleanName, normalizeName } from '../lib/history';
import { getKnownCategory } from '../lib/icons';

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const byCreatedAt = (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '');

/**
 * Verwaltet die Einkaufsliste – geräteübergreifend geteilt via Supabase
 * (Echtzeit) oder rein lokal via localStorage, je nach Konfiguration.
 *
 * @param {{ onPurchase?: (items: Array) => void }} options
 *        onPurchase wird beim Verbuchen erledigter Artikel aufgerufen (z. B. um
 *        den lokalen Kaufverlauf zu aktualisieren).
 * @returns Liste, Operationen und Sync-Status.
 */
export function useShoppingItems({ onPurchase } = {}) {
  const [items, setItems] = useState(() =>
    isCloudEnabled ? [] : readStorage(STORAGE_KEYS.items, []),
  );
  const [status, setStatus] = useState(isCloudEnabled ? 'connecting' : 'local');

  // Aktuelle Liste als Ref, damit asynchrone Callbacks (DB, Realtime) stets den
  // neuesten Stand lesen können, ohne von veralteten Closures abzuhängen.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Setzt Items. Reiner State-Update ohne Seiteneffekt – so bleibt der Updater
  // unter React StrictMode gefahrlos doppelt aufrufbar.
  const applyItems = useCallback((updater) => setItems(updater), []);

  // Persistenz als Effekt (nicht im Updater): läuft nach dem Commit und ist
  // idempotent, StrictMode-Doppelläufe schaden daher nicht.
  useEffect(() => {
    if (!isCloudEnabled) writeStorage(STORAGE_KEYS.items, items);
  }, [items]);

  // ── Cloud: Initialladen + Realtime-Abo ──────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!isCloudEnabled) return;
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('list_id', LIST_ID)
      .order('created_at', { ascending: true });
    if (error) {
      setStatus('error');
      return;
    }
    setItems(data.map(rowToItem));
    setStatus('live');
  }, []);

  useEffect(() => {
    if (!isCloudEnabled) return undefined;

    let active = true;
    let channel = null;
    refetch();

    // Client wird lazy geladen; Abo erst aufbauen, wenn er bereit ist.
    getSupabase().then((supabase) => {
      if (!active || !supabase) return;
      channel = supabase
        .channel(`list_items:${LIST_ID}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: TABLE, filter: `list_id=eq.${LIST_ID}` },
          (payload) => {
            if (!active) return;
            setItems((prev) => {
              if (payload.eventType === 'DELETE') {
                return prev.filter((it) => it.id !== payload.old.id);
              }
              const item = rowToItem(payload.new);
              const exists = prev.some((it) => it.id === item.id);
              const next = exists
                ? prev.map((it) => (it.id === item.id ? item : it))
                : [...prev, item];
              return next.sort(byCreatedAt);
            });
          },
        )
        .subscribe((state) => {
          if (!active) return;
          if (state === 'SUBSCRIBED') setStatus('live');
          else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('error');
        });
    });

    return () => {
      active = false;
      // Abräumen, sobald der Client verfügbar ist (gecacht, kein erneuter Import).
      if (channel) getSupabase().then((supabase) => supabase?.removeChannel(channel));
    };
  }, [refetch]);

  // ── Operationen ─────────────────────────────────────────────────────────────
  const addItem = useCallback(
    async (rawName, category) => {
      const name = cleanName(rawName);
      const key = normalizeName(name);
      if (!key) return;

      const existing = itemsRef.current.find((it) => normalizeName(it.name) === key);
      if (existing) {
        // Bereits vorhanden: nur reaktivieren, keine Dublette.
        if (existing.checked) await toggleItem(existing.id, false);
        return;
      }

      const resolvedCategory = category ?? getKnownCategory(name);
      const item = {
        id: createId(),
        name,
        category: resolvedCategory,
        checked: false,
        createdAt: new Date().toISOString(),
      };

      applyItems((prev) => [...prev, item]); // optimistisch

      if (isCloudEnabled) {
        const supabase = await getSupabase();
        const { error } = await supabase.from(TABLE).insert({
          id: item.id,
          list_id: LIST_ID,
          name: item.name,
          category: item.category,
          checked: false,
        });
        if (error) refetch();
      }
    },
    // toggleItem ist stabil (siehe unten); Auslassen vermeidet Zirkularität.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyItems, refetch],
  );

  const toggleItem = useCallback(
    async (id, forcedValue) => {
      const current = itemsRef.current.find((it) => it.id === id);
      if (!current) return;
      const checked = typeof forcedValue === 'boolean' ? forcedValue : !current.checked;

      applyItems((prev) => prev.map((it) => (it.id === id ? { ...it, checked } : it)));

      if (isCloudEnabled) {
        const supabase = await getSupabase();
        const { error } = await supabase.from(TABLE).update({ checked }).eq('id', id);
        if (error) refetch();
      }
    },
    [applyItems, refetch],
  );

  // Entfernt einen Artikel und liefert die entfernte Kopie zurück – so kann der
  // Aufrufer eine Undo-Aktion anbieten. Die Cloud-Löschung läuft im Hintergrund.
  const removeItem = useCallback(
    (id) => {
      const removed = itemsRef.current.find((it) => it.id === id);
      if (!removed) return null;

      applyItems((prev) => prev.filter((it) => it.id !== id));

      if (isCloudEnabled) {
        (async () => {
          const supabase = await getSupabase();
          const { error } = await supabase.from(TABLE).delete().eq('id', id);
          if (error) refetch();
        })();
      }
      return removed;
    },
    [applyItems, refetch],
  );

  // Stellt zuvor entfernte/archivierte Artikel vollständig wieder her (inkl.
  // checked-Status). Die ursprüngliche Reihenfolge ergibt sich aus createdAt.
  const restoreItems = useCallback(
    (restored) => {
      if (!restored || restored.length === 0) return;

      applyItems((prev) => {
        const known = new Set(prev.map((it) => it.id));
        const merged = [...prev, ...restored.filter((it) => !known.has(it.id))];
        return merged.sort(byCreatedAt);
      });

      if (isCloudEnabled) {
        (async () => {
          const supabase = await getSupabase();
          const rows = restored.map((it) => ({
            id: it.id,
            list_id: LIST_ID,
            name: it.name,
            category: it.category,
            checked: it.checked,
            created_at: it.createdAt,
          }));
          const { error } = await supabase.from(TABLE).insert(rows);
          if (error) refetch();
        })();
      }
    },
    [applyItems, refetch],
  );

  // Verbucht erledigte Artikel im Kaufverlauf und entfernt sie aus der Liste.
  // Gibt die archivierten Artikel zurück, damit der Aufruf Undo anbieten kann.
  const clearChecked = useCallback(() => {
    const checked = itemsRef.current.filter((it) => it.checked);
    if (checked.length === 0) return [];

    onPurchase?.(checked); // Kaufverlauf (lokal) aktualisieren – im Event-Handler,
    //                         nicht im State-Updater, daher unter StrictMode einmalig.

    applyItems((prev) => prev.filter((it) => !it.checked));

    if (isCloudEnabled) {
      (async () => {
        const supabase = await getSupabase();
        const { error } = await supabase
          .from(TABLE)
          .delete()
          .eq('list_id', LIST_ID)
          .eq('checked', true);
        if (error) refetch();
      })();
    }
    return checked;
  }, [applyItems, onPurchase, refetch]);

  return { items, status, addItem, toggleItem, removeItem, restoreItems, clearChecked };
}
