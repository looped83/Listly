// ─────────────────────────────────────────────────────────────────────────────
//  Schlanker Supabase-Client: nur Datenbank (PostgREST) + Realtime.
// ─────────────────────────────────────────────────────────────────────────────
//  Listly nutzt von Supabase ausschließlich Tabellenzugriffe und Live-Updates.
//  Das Komplettpaket @supabase/supabase-js brächte zusätzlich Auth, Storage und
//  Functions mit, die nie verwendet werden (~60 % des Chunks). Stattdessen die
//  beiden Einzelpakete direkt – gleich konfiguriert wie createClient() von
//  supabase-js für einen anonymen Zugriff ohne Sitzung.
//
//  Wird nur im Cloud-Modus per dynamischem Import geladen (siehe supabase.js)
//  und landet so als eigener Chunk außerhalb des Initial-Bundles.

import { PostgrestClient } from '@supabase/postgrest-js';
import { RealtimeClient } from '@supabase/realtime-js';

/**
 * Erzeugt den Client mit genau der Oberfläche, die die App nutzt:
 * `from(table)`, `channel(name)` und `removeChannel(channel)`.
 *
 * @param {string} url  Supabase-Projekt-URL (https://….supabase.co)
 * @param {string} key  anon-/publishable Key
 */
export function createClient(url, key) {
  const baseUrl = url.replace(/\/+$/, '');
  const rest = new PostgrestClient(`${baseUrl}/rest/v1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    schema: 'public',
  });
  const realtime = new RealtimeClient(`${baseUrl.replace(/^http/, 'ws')}/realtime/v1`, {
    params: { apikey: key },
    // Ohne Login ist der Schlüssel selbst das Zugriffstoken (wie in supabase-js).
    accessToken: async () => key,
  });

  return {
    from: (table) => rest.from(table),
    channel: (name) => realtime.channel(name),
    removeChannel: (channel) => realtime.removeChannel(channel),
  };
}
