import { SUPABASE_URL, SUPABASE_ANON_KEY, LIST_ID } from './supabaseConfig';
import { coerceQuantity, coerceUnit } from './itemFields';

// Cloud-Sync ist nur aktiv, wenn URL und Key konfiguriert sind. Andernfalls
// bleibt Listly im lokalen Modus (localStorage) voll funktionsfähig.
export const isCloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const TABLE = 'list_items';
export { LIST_ID };

// @supabase/supabase-js ist der größte Bundle-Treiber, wird aber nur im
// Cloud-Modus gebraucht. Daher lazy per dynamischem Import: im lokalen Modus
// gar nicht geladen, sonst als eigener Chunk parallel zum ersten Render.
let clientPromise = null;

/**
 * Liefert den (einmalig erzeugten) Supabase-Client – oder `null` im lokalen
 * Modus. Der Import wird beim ersten Aufruf angestoßen und danach gecacht.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient | null>}
 */
export function getSupabase() {
  if (!isCloudEnabled) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }),
    );
  }
  return clientPromise;
}

/**
 * DB-Zeile → App-Artikel. Die optionalen Spalten quantity/unit werden defensiv
 * gelesen: fehlen sie (ältere DB ohne die Spalten), greifen die Standardwerte,
 * sodass Cloud-Sync auch ohne Schema-Update funktioniert. Eine evtl. noch
 * vorhandene note-Spalte wird bewusst ignoriert (Feature entfernt).
 */
export function rowToItem(row) {
  const item = {
    id: row.id,
    name: row.name,
    category: row.category ?? null,
    checked: Boolean(row.checked),
    createdAt: row.created_at,
  };
  const quantity = coerceQuantity(row.quantity);
  if (quantity !== null) item.quantity = quantity;
  const unit = coerceUnit(row.unit);
  if (unit) item.unit = unit;
  return item;
}

/**
 * App-Artikel → DB-Zeile (Gegenstück zu rowToItem), z. B. beim Anlegen und bei
 * der Undo-Wiederherstellung. Die optionalen Felder quantity/unit werden
 * omit-empty übernommen – eine Wiederherstellung bleibt dadurch verlustfrei,
 * ohne leere Werte zu materialisieren.
 */
export function itemToRow(item) {
  const row = {
    id: item.id,
    list_id: LIST_ID,
    name: item.name,
    category: item.category,
    checked: Boolean(item.checked),
  };
  if (item.createdAt) row.created_at = item.createdAt;
  const quantity = coerceQuantity(item.quantity);
  if (quantity !== null) row.quantity = quantity;
  const unit = coerceUnit(item.unit);
  if (unit) row.unit = unit;
  return row;
}
