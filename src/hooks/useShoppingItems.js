import { useCallback, useEffect, useRef, useState } from 'react';
import { isCloudEnabled, supabase, rowToItem, TABLE, LIST_ID } from '../lib/supabase';
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

  // Setzt Items und persistiert sie im lokalen Modus.
  const applyItems = useCallback((updater) => {
    setItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!isCloudEnabled) writeStorage(STORAGE_KEYS.items, next);
      return next;
    });
  }, []);

  // ── Cloud: Initialladen + Realtime-Abo ──────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!isCloudEnabled) return;
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
    refetch();

    const channel = supabase
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

    return () => {
      active = false;
      supabase.removeChannel(channel);
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
        const { error } = await supabase.from(TABLE).update({ checked }).eq('id', id);
        if (error) refetch();
      }
    },
    [applyItems, refetch],
  );

  const removeItem = useCallback(
    async (id) => {
      applyItems((prev) => prev.filter((it) => it.id !== id));
      if (isCloudEnabled) {
        const { error } = await supabase.from(TABLE).delete().eq('id', id);
        if (error) refetch();
      }
    },
    [applyItems, refetch],
  );

  const clearChecked = useCallback(async () => {
    const checked = itemsRef.current.filter((it) => it.checked);
    if (checked.length === 0) return;

    onPurchase?.(checked); // Kaufverlauf (lokal) aktualisieren

    applyItems((prev) => prev.filter((it) => !it.checked));

    if (isCloudEnabled) {
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('list_id', LIST_ID)
        .eq('checked', true);
      if (error) refetch();
    }
  }, [applyItems, onPurchase, refetch]);

  return { items, status, addItem, toggleItem, removeItem, clearChecked };
}
