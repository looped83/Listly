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
-- ("offener geteilter Link"), aber NUR für die eigene Liste. Wer den anon-Key
-- kennt, kann so keine weiteren Listen anlegen oder die DB unter fremden
-- list_ids vollschreiben.
-- ⚠️ Der Wert muss LIST_ID in src/lib/supabaseConfig.js entsprechen. Wer die
-- LIST_ID ändert, passt ihn hier an und führt das Skript erneut aus.
drop policy if exists "listly_anon_all" on public.list_items;
create policy "listly_anon_all"
  on public.list_items
  for all
  to anon
  using (list_id = 'rene-und-lutz')
  with check (list_id = 'rene-und-lutz');

-- Plausibilitätsgrenzen (großzügig über dem, was die App erzeugt), damit
-- niemand per API riesige Texte oder Unsinnswerte ablegen kann.
alter table public.list_items drop constraint if exists list_items_name_check;
alter table public.list_items add constraint list_items_name_check
  check (char_length(btrim(name)) between 1 and 200);
alter table public.list_items drop constraint if exists list_items_category_check;
alter table public.list_items add constraint list_items_category_check
  check (char_length(category) <= 50);
alter table public.list_items drop constraint if exists list_items_quantity_check;
alter table public.list_items add constraint list_items_quantity_check
  check (quantity between 1 and 9999);

-- Obergrenze pro Liste: begrenzt, wie weit sich die Tabelle per API füllen
-- lässt. Ein normaler Einkaufszettel bleibt weit darunter. Die Zählung nutzt
-- den Index list_items_list_id_idx.
create or replace function public.list_items_enforce_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.list_items where list_id = new.list_id) >= 1000 then
    raise exception 'Listly: maximal 1000 Artikel pro Liste' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists list_items_limit on public.list_items;
create trigger list_items_limit
  before insert on public.list_items
  for each row execute function public.list_items_enforce_limit();

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
