import { useCallback, useEffect, useRef, useState } from 'react';
import { isCloudEnabled, getSupabase, rowToItem, itemToRow, TABLE, LIST_ID } from '../lib/supabase';
import { readStorage, writeStorage, STORAGE_KEYS } from '../lib/storage';
import { cleanName, normalizeName } from '../lib/history';
import { getKnownCategory } from '../lib/icons';
import { coerceQuantity } from '../lib/itemFields';

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
  // Aktualisierung im Effekt (nach dem Commit), nicht während des Renderns.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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
    try {
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
    } catch {
      // Import-/Netzwerkfehler (z. B. offline beim ersten Laden) → Offline-
      // Status statt unbehandelter Promise-Rejection.
      setStatus('error');
    }
  }, []);

  /**
   * Führt eine Schreiboperation im Hintergrund gegen die Cloud aus (no-op im
   * lokalen Modus). Meldet die DB einen Fehler, wird der Zustand per Refetch
   * neu vom Server geladen; Import-/Netzwerkfehler enden im Offline-Status
   * statt in einer unbehandelten Promise-Rejection.
   */
  const runCloudWrite = useCallback(
    (operation) => {
      if (!isCloudEnabled) return;
      (async () => {
        const supabase = await getSupabase();
        const { error } = await operation(supabase);
        if (error) await refetch();
      })().catch(() => setStatus('error'));
    },
    [refetch],
  );

  useEffect(() => {
    if (!isCloudEnabled) return undefined;

    let active = true;
    let channel = null;
    // Initiales Laden vom Server: asynchroner Roundtrip, setState erst nach
    // der Antwort – kein synchroner Kaskaden-Render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();

    // Client wird lazy geladen; Abo erst aufbauen, wenn er bereit ist.
    getSupabase()
      .then((supabase) => {
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
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      // Abräumen, sobald der Client verfügbar ist (gecacht, kein erneuter Import).
      if (channel) {
        getSupabase()
          .then((supabase) => supabase?.removeChannel(channel))
          .catch(() => {});
      }
    };
  }, [refetch]);

  // ── Operationen ─────────────────────────────────────────────────────────────
  const toggleItem = useCallback(
    (id, forcedValue) => {
      const current = itemsRef.current.find((it) => it.id === id);
      if (!current) return;
      const checked = typeof forcedValue === 'boolean' ? forcedValue : !current.checked;

      applyItems((prev) => prev.map((it) => (it.id === id ? { ...it, checked } : it)));

      runCloudWrite((supabase) => supabase.from(TABLE).update({ checked }).eq('id', id));
    },
    [applyItems, runCloudWrite],
  );

  /**
   * Fügt einen Artikel hinzu – oder erkennt eine Dublette (nach Name,
   * groß-/kleinschreibungs- und leerzeicheninsensitiv) und reagiert eindeutig
   * darauf. Liefert ein Ergebnisobjekt statt still zu bleiben, damit jede
   * Eingabequelle (manuelle Eingabe, Autovervollständigung, Chips) identisches
   * Feedback anzeigen kann:
   *   - { status: 'added', item }        – neu angelegt
   *   - { status: 'alreadyOpen', item }  – steht bereits offen auf der Liste
   *   - { status: 'reactivated', item }  – war erledigt, wieder auf offen gesetzt
   *   - { status: 'invalid' }            – leerer/blanker Name
   *
   * Bewusst synchron (keine Cloud-Roundtrip-Wartezeit): Dubletten-Prüfung und
   * optimistisches Update laufen komplett vor jedem `await`, daher liest jeder
   * Aufruf stets den aktuellen `itemsRef`-Stand – keine stale Closures, keine
   * Race Conditions durch parallele Aufrufe aus verschiedenen Quellen.
   *
   * `extras` (optional, aus dem Hinzufügen-Sheet) trägt die Menge bei –
   * sie werden nur an einem NEU angelegten Artikel gesetzt. Die Dubletten-
   * Erkennung läuft unverändert allein über den (normalisierten) Namen; ein
   * bereits vorhandener Artikel wird nicht mit einer neuen Menge überschrieben.
   */
  const addItem = useCallback(
    (rawName, category, extras) => {
      const name = cleanName(rawName);
      const key = normalizeName(name);
      if (!key) return { status: 'invalid' };

      const existing = itemsRef.current.find((it) => normalizeName(it.name) === key);
      if (existing) {
        if (existing.checked) {
          toggleItem(existing.id, false); // optimistisch synchron; Cloud-Sync im Hintergrund
          return { status: 'reactivated', item: { ...existing, checked: false } };
        }
        return { status: 'alreadyOpen', item: existing };
      }

      const resolvedCategory = category ?? getKnownCategory(name);
      const item = {
        id: createId(),
        name,
        category: resolvedCategory,
        checked: false,
        createdAt: new Date().toISOString(),
      };

      // Optionale Menge – nur ≥ 2 materialisieren (1 ist der implizite Standard;
      // coerceQuantity gibt dafür null zurück). Konsistent mit Sanitizer/Migration.
      const quantity = coerceQuantity(extras?.quantity);
      if (quantity !== null) item.quantity = quantity;

      applyItems((prev) => [...prev, item]); // optimistisch

      runCloudWrite((supabase) => supabase.from(TABLE).insert(itemToRow(item)));

      return { status: 'added', item };
    },
    [applyItems, runCloudWrite, toggleItem],
  );

  // Aktualisiert Felder eines Artikels (Name, Kategorie, Menge).
  // Reiner State-Patch; die Cloud-Aktualisierung läuft im Hintergrund.
  const updateItem = useCallback(
    (id, patch) => {
      applyItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

      runCloudWrite((supabase) => {
        const dbPatch = {};
        if ('name' in patch) dbPatch.name = patch.name;
        if ('category' in patch) dbPatch.category = patch.category;
        if ('quantity' in patch) dbPatch.quantity = patch.quantity;
        return supabase.from(TABLE).update(dbPatch).eq('id', id);
      });
    },
    [applyItems, runCloudWrite],
  );

  // Entfernt einen Artikel und liefert die entfernte Kopie zurück – so kann der
  // Aufrufer eine Undo-Aktion anbieten. Die Cloud-Löschung läuft im Hintergrund.
  const removeItem = useCallback(
    (id) => {
      const removed = itemsRef.current.find((it) => it.id === id);
      if (!removed) return null;

      applyItems((prev) => prev.filter((it) => it.id !== id));

      runCloudWrite((supabase) => supabase.from(TABLE).delete().eq('id', id));

      return removed;
    },
    [applyItems, runCloudWrite],
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

      // itemToRow überträgt auch die Menge – die Wiederherstellung bleibt
      // dadurch geräteübergreifend verlustfrei.
      runCloudWrite((supabase) => supabase.from(TABLE).insert(restored.map(itemToRow)));
    },
    [applyItems, runCloudWrite],
  );

  // Schließt den Einkauf ab: verbucht die betroffenen Artikel im Kaufverlauf und
  // entfernt sie aus der aktiven Liste. Standardmäßig nur abgehakte Artikel;
  // mit includeOpen bewusst alle. Gibt die abgeschlossenen Artikel zurück, damit
  // der Aufrufer eine Undo-Aktion anbieten kann.
  const completeCheckout = useCallback(
    (includeOpen = false) => {
      const completed = itemsRef.current.filter((it) => includeOpen || it.checked);
      if (completed.length === 0) return [];

      onPurchase?.(completed); // Kaufverlauf (lokal) aktualisieren – im Event-Handler,
      //                          nicht im State-Updater, daher unter StrictMode einmalig.

      const completedIds = new Set(completed.map((it) => it.id));
      applyItems((prev) => prev.filter((it) => !completedIds.has(it.id)));

      runCloudWrite((supabase) => supabase.from(TABLE).delete().in('id', [...completedIds]));

      return completed;
    },
    [applyItems, onPurchase, runCloudWrite],
  );

  return {
    items,
    status,
    addItem,
    toggleItem,
    updateItem,
    removeItem,
    restoreItems,
    completeCheckout,
  };
}
