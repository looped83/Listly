-- ─────────────────────────────────────────────────────────────────────────────
--  Listly – geteilte Einkaufsliste (Supabase)
-- ─────────────────────────────────────────────────────────────────────────────
--  So einrichten:
--    1. Supabase-Projekt erstellen (kostenlos) unter https://supabase.com
--    2. Im Dashboard: "SQL Editor" → "New query" → dieses Skript einfügen → "Run"
--    3. Unter "Project Settings → API" die "Project URL" und den "anon public"
--       Key kopieren und in src/lib/supabaseConfig.js eintragen.
--
--  Das Skript ist wiederholbar ausführbar (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id text not null,
  name text not null,
  category text,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Optionales Artikelfeld (Menge). Additiv und idempotent –
-- bei einer bestehenden Tabelle einfach dieses Skript erneut ausführen.
alter table public.list_items add column if not exists quantity numeric;

create index if not exists list_items_list_id_idx
  on public.list_items (list_id, created_at);

-- Vollständige alte Zeilen bei Änderungen/Löschungen liefern, damit Realtime-
-- Filter (list_id) und DELETE-Events zuverlässig funktionieren.
alter table public.list_items replica identity full;

-- Row Level Security aktivieren …
alter table public.list_items enable row level security;

-- … und Lesen/Schreiben für den anonymen Browser-Zugriff freigeben
-- ("offener geteilter Link"). Achtung: erlaubt Zugriff für jeden mit dem
-- anon-Key; der Schutz erfolgt bewusst nur über die geheime LIST_ID.
drop policy if exists "listly_anon_all" on public.list_items;
create policy "listly_anon_all"
  on public.list_items
  for all
  to anon
  using (true)
  with check (true);

-- Realtime (Live-Updates auf allen Geräten) für die Tabelle aktivieren.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'list_items'
  ) then
    alter publication supabase_realtime add table public.list_items;
  end if;
end $$;
