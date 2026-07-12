import { SUPABASE_URL, SUPABASE_ANON_KEY, LIST_ID } from './supabaseConfig';

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
