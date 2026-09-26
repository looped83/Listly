import { useCallback, useEffect, useRef, useState } from 'react';
import { isCloudEnabled, getSupabase, rowToItem, TABLE, LIST_ID } from '../lib/supabase';
import {
  applyOps,
  byCreatedAt,
  isRetryable,
  mergeOps,
  runOp,
  sanitizeOps,
} from '../lib/syncQueue';
import { readStorage, writeStorage, STORAGE_KEYS } from '../lib/storage';
import { cleanName, normalizeName } from '../lib/history';
import { getKnownCategory } from '../lib/icons';
import { coerceQuantity } from '../lib/itemFields';
import { sanitizeItems } from '../lib/schema';

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Startstand der Liste – oder `null`, wenn noch keiner bekannt ist.
 * Lokal: die gespeicherte Liste. Cloud: der zuletzt vom Server geladene Stand
 * (stale-while-revalidate) – so ist die Liste beim Start sofort da, auch ohne
 * Netz. Ein Cache einer anderen LIST_ID wird ignoriert (frische Liste).
 */
function readInitialItems() {
  if (!isCloudEnabled) return readStorage(STORAGE_KEYS.items, []);
  const cached = readStorage(STORAGE_KEYS.cloudItems, null);
  return cached?.listId === LIST_ID ? sanitizeItems(cached.items) : null;
}

/** Noch nicht gesendete Cloud-Änderungen aus dem letzten Lauf (nur diese Liste). */
function readPendingOps() {
  if (!isCloudEnabled) return [];
  const stored = readStorage(STORAGE_KEYS.pendingOps, null);
  return stored?.listId === LIST_ID ? sanitizeOps(stored.ops) : [];
}

/**
 * Verwaltet die Einkaufsliste – geräteübergreifend geteilt via Supabase
 * (Echtzeit) oder rein lokal via localStorage, je nach Konfiguration.
 *
 * @param {{ onPurchase?: (items: Array) => void }} options
 *        onPurchase wird beim Verbuchen erledigter Artikel aufgerufen (z. B. um
 *        den lokalen Kaufverlauf zu aktualisieren).
 * @returns Liste, Operationen, Sync-Status, `pendingCount` (Anzahl noch nicht
 *          gesendeter Änderungen) und `loadState`: `ready` (ein Stand liegt vor –
 *          gecacht oder vom Server), `loading` (noch keiner, Abfrage läuft) oder
 *          `offline` (noch keiner, Abfrage gescheitert). Nur bei `ready`
 *          bedeutet eine leere Liste wirklich „leer“.
 */
export function useShoppingItems({ onPurchase } = {}) {
  const [initialItems] = useState(readInitialItems);
  const [items, setItems] = useState(initialItems ?? []);
  const [loadState, setLoadState] = useState(initialItems !== null ? 'ready' : 'loading');
  const [status, setStatus] = useState(isCloudEnabled ? 'connecting' : 'local');

  // Aktuelle Liste als Ref, damit asynchrone Callbacks (DB, Realtime) stets den
  // neuesten Stand lesen können, ohne von veralteten Closures abzuhängen.
  // Aktualisierung im Effekt (nach dem Commit), nicht während des Renderns.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Stabiler Lesezugriff auf den aktuellen Stand für Event-Handler der
  // Aufrufer (z. B. „Wird dieser Artikel gerade abgehakt?“) – ohne dass deren
  // Callbacks von `items` abhängen und damit bei jeder Änderung neu entstehen
  // (was die memoisierten Zeilen/Kacheln sonst allesamt neu rendern ließe).
  const findItem = useCallback((predicate) => itemsRef.current.find(predicate) ?? null, []);

  // Setzt Items. Reiner State-Update ohne Seiteneffekt – so bleibt der Updater
  // unter React StrictMode gefahrlos doppelt aufrufbar.
  const applyItems = useCallback((updater) => setItems(updater), []);

  // Persistenz als Effekt (nicht im Updater): läuft nach dem Commit und ist
  // idempotent, StrictMode-Doppelläufe schaden daher nicht. Im Cloud-Modus
  // wird erst gecacht, wenn ein echter Stand vorliegt – sonst würde eine noch
  // unbekannte Liste beim nächsten Start fälschlich als „leer“ gelten.
  useEffect(() => {
    if (!isCloudEnabled) writeStorage(STORAGE_KEYS.items, items);
    else if (loadState === 'ready') {
      writeStorage(STORAGE_KEYS.cloudItems, { listId: LIST_ID, items });
    }
  }, [items, loadState]);

  // ── Cloud: Warteschlange ausstehender Änderungen ────────────────────────────
  // Jede Änderung wird als Operation vorgemerkt (auch über Neustarts hinweg
  // gespeichert) und der Reihe nach gesendet. Scheitert das am Netz, bleibt
  // sie stehen und geht beim nächsten Abgleich raus (siehe lib/syncQueue.js).
  const [initialOps] = useState(readPendingOps);
  const pendingRef = useRef(initialOps);
  const [pendingCount, setPendingCount] = useState(initialOps.length);

  const setPending = useCallback((ops) => {
    pendingRef.current = ops;
    setPendingCount(ops.length);
    writeStorage(STORAGE_KEYS.pendingOps, { listId: LIST_ID, ops });
  }, []);

  /**
   * Sendet ausstehende Operationen der Reihe nach (nie parallel – so bleibt
   * z. B. „anlegen, dann abhaken“ in der richtigen Reihenfolge). Bei einem
   * Netzfehler bricht sie ab und lässt den Rest für später stehen; lehnt die DB
   * eine Operation inhaltlich ab, wird sie verworfen. Liefert `true`, wenn
   * etwas verworfen wurde (dann sollte der Serverstand neu geladen werden).
   */
  const flushingRef = useRef(false);
  const flush = useCallback(async () => {
    if (!isCloudEnabled || flushingRef.current || pendingRef.current.length === 0) return false;
    flushingRef.current = true;
    let rejected = false;
    try {
      const supabase = await getSupabase();
      while (pendingRef.current.length > 0) {
        const op = pendingRef.current[0];
        const result = await runOp(supabase, op);
        if (result.error && isRetryable(result)) {
          setStatus('error');
          break;
        }
        if (result.error) rejected = true;
        setPending(pendingRef.current.filter((pending) => pending.opId !== op.opId));
      }
    } catch {
      setStatus('error'); // Client nicht ladbar (offline) → beim nächsten Abgleich erneut
    } finally {
      flushingRef.current = false;
    }
    return rejected;
  }, [setPending]);

  // ── Cloud: Laden + Realtime-Abo ─────────────────────────────────────────────
  // Laufende Nummer der Abfragen: überholt eine neuere Abfrage eine ältere
  // (z. B. App-Rückkehr + Reconnect kurz hintereinander), gewinnt stets die
  // neueste – eine verspätete ältere Antwort überschreibt nichts.
  const fetchSeq = useRef(0);
  const refetch = useCallback(async () => {
    if (!isCloudEnabled) return;
    const seq = ++fetchSeq.current;
    try {
      // Eigene ausstehende Änderungen zuerst senden, dann den Stand holen.
      await flush();
      const opsAtStart = pendingRef.current;
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('list_id', LIST_ID)
        .order('created_at', { ascending: true });
      if (seq !== fetchSeq.current) return;
      if (error) throw error;
      // Serverstand + alles, was beim Start der Abfrage noch ausstand oder
      // seither dazukam – so springen eigene, noch nicht (sicher) angekommene
      // Änderungen nicht zurück. Doppelt Angewandtes schadet nicht (idempotent).
      const ops = mergeOps(opsAtStart, pendingRef.current);
      setItems(applyOps(data.map(rowToItem), ops));
      setLoadState('ready');
      setStatus('live');
    } catch {
      // DB-/Import-/Netzwerkfehler (z. B. offline beim ersten Laden) → Offline-
      // Status statt unbehandelter Promise-Rejection. Ein bereits vorhandener
      // (gecachter) Stand bleibt stehen.
      if (seq !== fetchSeq.current) return;
      setStatus('error');
      setLoadState((prev) => (prev === 'ready' ? prev : 'offline'));
    }
  }, [flush]);

  /**
   * Merkt eine Cloud-Änderung vor und stößt das Senden an (no-op im lokalen
   * Modus). Hat die DB etwas abgelehnt, wird der Serverstand neu geladen.
   */
  const enqueue = useCallback(
    (op) => {
      if (!isCloudEnabled) return;
      setPending([...pendingRef.current, { opId: createId(), ...op }]);
      flush().then((rejected) => rejected && refetch());
    },
    [setPending, flush, refetch],
  );

  useEffect(() => {
    if (!isCloudEnabled) return undefined;

    let active = true;
    let channel = null;
    // Initiales Laden vom Server: asynchroner Roundtrip, setState erst nach
    // der Antwort – kein synchroner Kaskaden-Render. Startet bewusst sofort
    // (schnellster Weg zu frischen Daten); der Abgleich nach dem Abo (s. u.)
    // schließt die Lücke bis dahin.
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
            if (state === 'SUBSCRIBED') {
              setStatus('live');
              // Realtime liefert nur Änderungen AB dem (erneuten) Abo, keine
              // verpassten. Daher nach jedem (Wieder-)Verbinden einmal
              // abgleichen – sonst fehlt z. B. nach Standby oder Funkloch, was
              // zwischenzeitlich auf dem anderen Gerät geändert wurde.
              refetch();
            } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
              setStatus('error');
            }
          });
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    // Zurück in der App (aus dem Hintergrund/Standby) oder wieder online:
    // sofort abgleichen, statt zu warten, bis Realtime den Verbindungsabbruch
    // selbst bemerkt (auf Mobilgeräten oft erst nach vielen Sekunden).
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refetch);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refetch);
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
      const current = findItem((it) => it.id === id);
      if (!current) return;
      const checked = typeof forcedValue === 'boolean' ? forcedValue : !current.checked;

      applyItems((prev) => prev.map((it) => (it.id === id ? { ...it, checked } : it)));

      enqueue({ type: 'update', itemId: id, patch: { checked } });
    },
    [applyItems, findItem, enqueue],
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

      const existing = findItem((it) => normalizeName(it.name) === key);
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

      enqueue({ type: 'upsert', items: [item] });

      return { status: 'added', item };
    },
    [applyItems, findItem, enqueue, toggleItem],
  );

  // Aktualisiert Felder eines Artikels (Name, Kategorie, Menge).
  // Reiner State-Patch; die Cloud-Aktualisierung läuft im Hintergrund.
  const updateItem = useCallback(
    (id, patch) => {
      applyItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

      const dbPatch = {};
      if ('name' in patch) dbPatch.name = patch.name;
      if ('category' in patch) dbPatch.category = patch.category;
      if ('quantity' in patch) dbPatch.quantity = patch.quantity;
      enqueue({ type: 'update', itemId: id, patch: dbPatch });
    },
    [applyItems, enqueue],
  );

  // Entfernt einen Artikel und liefert die entfernte Kopie zurück – so kann der
  // Aufrufer eine Undo-Aktion anbieten. Die Cloud-Löschung läuft im Hintergrund.
  const removeItem = useCallback(
    (id) => {
      const removed = findItem((it) => it.id === id);
      if (!removed) return null;

      applyItems((prev) => prev.filter((it) => it.id !== id));

      enqueue({ type: 'delete', itemIds: [id] });

      return removed;
    },
    [applyItems, findItem, enqueue],
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

      // Beim Senden überträgt itemToRow auch die Menge – die Wiederherstellung
      // bleibt dadurch geräteübergreifend verlustfrei.
      enqueue({ type: 'upsert', items: restored });
    },
    [applyItems, enqueue],
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

      enqueue({ type: 'delete', itemIds: [...completedIds] });

      return completed;
    },
    [applyItems, onPurchase, enqueue],
  );

  return {
    items,
    status,
    pendingCount,
    loadState,
    findItem,
    addItem,
    toggleItem,
    updateItem,
    removeItem,
    restoreItems,
    completeCheckout,
  };
}
