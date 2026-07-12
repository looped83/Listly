import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, LIST_ID } from './supabaseConfig';

// Cloud-Sync ist nur aktiv, wenn URL und Key konfiguriert sind. Andernfalls
// bleibt Listly im lokalen Modus (localStorage) voll funktionsfähig.
export const isCloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const TABLE = 'list_items';
export { LIST_ID };

// Ein einziger Client für die gesamte App (null im lokalen Modus).
export const supabase = isCloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
  : null;

/** DB-Zeile → App-Artikel. */
export function rowToItem(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? null,
    checked: Boolean(row.checked),
    createdAt: row.created_at,
  };
}
