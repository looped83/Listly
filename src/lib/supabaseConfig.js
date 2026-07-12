// ─────────────────────────────────────────────────────────────────────────────
//  Supabase-Zugangsdaten für die GETEILTE Liste
// ─────────────────────────────────────────────────────────────────────────────
//
//  Trage hier die Werte aus deinem Supabase-Projekt ein
//  (Dashboard → Project Settings → API):
//    • SUPABASE_URL       = "Project URL"
//    • SUPABASE_ANON_KEY  = "anon public" Key
//
//  Solange beide Felder leer sind, arbeitet Listly rein lokal (nur auf diesem
//  Gerät). Sobald sie ausgefüllt und deployt sind, teilen sich alle Geräte,
//  welche dieselbe veröffentlichte App öffnen, automatisch dieselbe Liste.
//
//  Hinweis: Der anon-Key ist für den Einsatz im Browser gedacht und darf
//  öffentlich sein – der Schutz erfolgt über die Datenbank-Regeln (siehe
//  supabase/schema.sql). Bei "offener geteilter Link" ist der Zugriff bewusst
//  nur durch die (geheime) LIST_ID geschützt.
//
export const SUPABASE_URL = 'https://jdjnncjrrreseqxyvyrp.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkam5uY2pycnJlc2VxeHl2eXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTMxNDAsImV4cCI6MjA5OTQyOTE0MH0.Nv1imt0UiiZN_5g1W7uC9Oa9RXyCUQO_P4MmXtmOX8k';

//  Gemeinsame Kennung eurer Liste. Beliebiger, schwer zu erratender Text –
//  beide Geräte nutzen automatisch denselben Wert, weil er fest in der
//  veröffentlichten App steht. Bei Bedarf ändern (dann startet ihr mit einer
//  frischen, leeren Liste).
export const LIST_ID = 'rene-und-lutz';
