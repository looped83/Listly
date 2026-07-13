# Listly – Handover

Stand: Juli 2026 (aktueller Branch-Tip). Diese Datei fasst Architektur, Betrieb
und Besonderheiten zusammen, damit jemand die Weiter­ent­wicklung ohne Vorwissen
übernehmen kann.

> 🔒 **Datenschutz:** Persönliche Kundenkarten-Nummern gehören **nicht** in
> dieses (öffentliche) Repo. Versehentlich committete Nummern wurden entfernt und
> die **Git-Historie davon bereinigt** (Rewrite + force-push). Beispiel-Platzhalter
> im Code daher immer generisch halten – niemals echte Nummern hardcoden.

---

## 1. Überblick

**Listly** ist eine schlanke, vegan ausgelegte **Einkaufslisten-PWA** (Vite +
React 18). Sie läuft als installierbare Web-App und wird von zwei Personen
gemeinsam in Echtzeit genutzt.

- **Live-URL:** https://looped83.github.io/Listly/ (GitHub Pages)
- **Repo:** `looped83/Listly` (öffentlich)
- **Default-Branch:** `main` · **Arbeitsbranch:** `claude/listly-vite-pwa-app-kiqlr6`
- **Geteilte Liste:** in Echtzeit über Supabase synchronisiert
- **Kundenkarten:** Lidl/Payback/dm/REWE mit QR/Barcode, rein lokal gespeichert

---

## 2. Tech-Stack & Voraussetzungen

- **Node.js ≥ 18**
- **Vite 5** + `@vitejs/plugin-react`
- **React 18**
- **lucide-react** – UI-Icons (Häkchen, Stern, Wallet …). Produkt-Symbole sind
  dagegen **Emoji** (keine Icon-Lib nötig).
- **@supabase/supabase-js** – Echtzeit-Sync der Liste
- **qrcode** + **jsbarcode** – Code-Erzeugung für Kundenkarten (Client-seitig)
- **vite-plugin-pwa** – Manifest + Service Worker
- Fonts (Fraunces, Inter, IBM Plex Mono) sind **lokal** eingebunden (kein CDN).
- **Code-Splitting:** `@supabase/supabase-js` (nur im Cloud-Modus) und das
  Kundenkarten-Modul mit `qrcode`/`jsbarcode` (nur beim Öffnen der Karten) werden
  **lazy** als eigene Chunks geladen – das initiale JS bleibt schlank.

```bash
npm install
npm run dev        # Dev-Server (http://localhost:5173)
npm run build      # Produktions-Build nach dist/
npm run preview    # gebautes Bundle lokal servieren
```

> ⚠️ Die App **muss über einen Server** laufen. `dist/index.html` direkt per
> Doppelklick (`file://`) zu öffnen ergibt eine weiße Seite (ES-Module/Service
> Worker sind über `file://` blockiert). `base: './'` in `vite.config.js` sorgt
> dafür, dass die App am Root **und** unter Unterpfaden (GitHub Pages `/Listly/`)
> funktioniert.

---

## 3. Projektstruktur

```
src/
├── App.jsx                 # Orchestrierung: State, Header, Liste, Dock, Karten-Overlay
├── main.jsx                # Einstieg, ErrorBoundary, Zoom-Sperre (Gesten)
├── components/
│   ├── AddItemForm.jsx     #   Suchfeld + Autovervollständigung (öffnet nach oben)
│   ├── FrequentChips.jsx   #   „Häufig gekauft“-Chips (oben angeheftet, scrollbar)
│   ├── ShoppingList.jsx    #   Liste, nach Kategorie gruppiert (offen + erledigt)
│   ├── ListItem.jsx        #   Einzelzeile inkl. Swipe-to-delete
│   ├── ProductIcon.jsx     #   rendert das Emoji eines Artikels
│   ├── SyncStatus.jsx      #   Live/Verbinde/Offline-Anzeige (oben rechts)
│   ├── CardsSheet.jsx      #   Kundenkarten-Overlay (Akkordeon) – via React.lazy geladen
│   └── CodeImage.jsx       #   <QRCode> und <Barcode> (qrcode / jsbarcode)
├── hooks/
│   ├── useLocalStorage.js  #   State ↔ localStorage (synchrones Schreiben)
│   ├── useShoppingItems.js #   Liste: Supabase (Echtzeit) ODER lokal, inkl. Ops
│   └── useTheme.js         #   automatischer Dark Mode (prefers-color-scheme)
├── lib/
│   ├── storage.js          #   localStorage-Keys + read/write
│   ├── supabase.js         #   Supabase-Client, lazy per dynamischem Import (getSupabase)
│   ├── supabaseConfig.js   #   ← URL, anon-Key, LIST_ID
│   ├── history.js          #   Kaufverlauf (Häufigkeit verbuchen)
│   ├── suggestions.js      #   Autocomplete- & Chip-Logik
│   ├── icons.js            #   Emoji-Auflösung + Kategorie-Infos
│   └── cards.js            #   Händler-Metadaten, Barcode-Format, Code-Inhalt
├── data/products.json      # 356 Produkte / 16 Kategorien (Emoji je Produkt)
├── styles/
│   ├── tokens.css          #   Design-Tokens Light + Dark (true black)
│   └── index.css           #   Base + alle Komponenten-Styles
└── assets/fonts/           # lokal gehostete woff2 + fonts.css (OFL)

.github/workflows/deploy.yml # Build + Push nach gh-pages
supabase/schema.sql          # Tabelle + RLS + Realtime für die geteilte Liste
```

---

## 4. Datenmodell & Speicherung

Alle Keys in `src/lib/storage.js` (`STORAGE_KEYS`).

| Ort            | Key/Tabelle        | Inhalt                                                              |
| -------------- | ------------------ | ------------------------------------------------------------------- |
| **Supabase**   | Tabelle `list_items` | Geteilte Liste: `{ id, list_id, name, category, checked, created_at }` |
| localStorage   | `listly.items`     | Liste **nur im lokalen Modus** (wenn Supabase nicht konfiguriert)   |
| localStorage   | `listly.favorites` | Favoriten `["Hafermilch", …]` (pro Gerät)                           |
| localStorage   | `listly.history`   | Kaufverlauf `{ [name]: { name, category, count, lastPurchased } }`   |
| localStorage   | `listly.cards`     | Kundenkarten `[{ id, retailer, name, code, codeType, number? }]` (pro Gerät) |
| localStorage   | `listly.theme`     | (historisch; wird aktuell **nicht** genutzt, Dark Mode folgt System)|
| localStorage   | `listly.schemaVersion` | Ganzzahl: Version des localStorage-Schemas (siehe §12)          |

**Wichtig:** Sobald Supabase konfiguriert ist (Standard), lebt die **Liste in
Supabase** und wird geräteübergreifend synchronisiert. **Favoriten, Kaufverlauf
und Kundenkarten sind bewusst lokal pro Gerät** – sie werden nicht geteilt.

Der lokale Speicher ist **versioniert** – beim App-Start läuft eine idempotente
Migrations-/Validierungspipeline (siehe **§12**), bevor Daten gelesen werden.

Artikel-Objekt (in App/State): `{ id, name, category, checked, createdAt }`.
`category` ist eine Kategorie-`id` aus `products.json` (oder `null` → „Sonstiges“).

---

## 5. Geteilte Liste (Supabase)

- Konfiguration in **`src/lib/supabaseConfig.js`**: `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `LIST_ID` (aktuell `"rene-und-lutz"`).
- Sind URL + Key gesetzt → **Cloud-Modus** (`isCloudEnabled` in `lib/supabase.js`).
  Sonst automatischer Fallback auf `localStorage`.
- **Lazy geladen:** `@supabase/supabase-js` wird erst im Cloud-Modus per
  dynamischem Import geholt (`getSupabase()`, Ergebnis gecacht) → eigener Chunk,
  kleiner Initial-Bundle. Alle DB-Zugriffe in `useShoppingItems` sind daher `async`.
- **`useShoppingItems.js`** kapselt beides: Initialladen (`select`), Realtime-Abo
  (`postgres_changes` gefiltert auf `list_id`), optimistische Updates, sowie
  add/toggle/remove/clearChecked. Bei Fehlern wird neu geladen (`refetch`).
- **Schema:** `supabase/schema.sql` (idempotent). Legt Tabelle an, aktiviert
  `REPLICA IDENTITY FULL` (nötig, damit Realtime-DELETE mit `list_id`-Filter
  funktioniert), RLS mit einer permissiven anon-Policy und die Realtime-
  Publikation. Bei einem neuen Supabase-Projekt einmal im SQL-Editor ausführen.
- **Zugriffsmodell „offener geteilter Link“:** kein Login. URL, anon-Key und
  `LIST_ID` stecken im ausgelieferten Bundle (und im öffentlichen Repo). Wer sie
  kennt, kann die Liste lesen/ändern – für eine Einkaufsliste bewusst akzeptiert.
  **Keine sensiblen Daten in die Liste legen.** Für echten Schutz bräuchte es
  eine Login-Variante (Supabase Auth) + strengere RLS-Policies.

Status-Anzeige oben rechts (`SyncStatus.jsx`): `live` (verbunden), `connecting`,
`error` (offline), `local` (kein Cloud-Sync konfiguriert).

---

## 6. Deployment (GitHub Pages)

Automatisch via **`.github/workflows/deploy.yml`** bei Push auf `main` oder den
Arbeitsbranch:

1. Build (`npm ci && npm run build`).
2. `touch dist/.nojekyll`.
3. Force-Push des `dist/`-Inhalts in den Branch **`gh-pages`** (mit `GITHUB_TOKEN`).

**Einmalige Repo-Einstellung:** Settings → Pages → Source = **„Deploy from a
branch“** → Branch **`gh-pages`** / `/ (root)`.

Warum dieser Weg statt der offiziellen Pages-Action: Die `github-pages`-Umgebung
erlaubt Actions-Deploys standardmäßig nur vom Default-Branch; der gh-pages-Push
funktioniert aus jedem Branch und ohne Zusatz-Einstellungen. Wenn künftig nur
noch von `main` deployt wird, kann der Branch-Trigger im Workflow entfernt werden.

Nach jedem Deploy auf dem Gerät einmal hart neu laden (Service Worker: der
Workbox-Cache wird via `cleanupOutdatedCaches/skipWaiting/clientsClaim` erneuert).

---

## 7. Kundenkarten

- Overlay über den **Wallet-Button** im Header (`CardsSheet.jsx`).
- **Rein lokal** gespeichert (`listly.cards`) – aus Datenschutzgründen bewusst
  **nicht** im Repo/Supabase (öffentliches Repo!). Jedes Gerät pflegt seine
  eigenen Karten.
- **Kartenmodell:** `{ id, retailer, name, code, codeType }`.
  - `retailer`: `lidl | payback | dm | rewe | custom` (Metadaten/Farbe/Standard-
    Typ in `lib/cards.js`, `RETAILERS`).
  - `code`: der **exakte Inhalt**, der in den Code kodiert wird.
  - `codeType`: `qr` oder `barcode` (EAN-13 bei gültiger 13-stelliger Zahl, sonst
    CODE128 – siehe `barcodeFormat`).
- **Wichtig – warum „exakter Inhalt“:** Original-QRs kodieren oft **mehr als die
  gedruckte Nummer** (Prüfziffer/Token). Aus reiner Nummer erzeugte Codes sehen
  anders aus und scannen ggf. nicht. Die echten Inhalte lassen sich aus einem
  Screenshot der jeweiligen Karte dekodieren (z. B. mit einer QR-Decode-Bibliothek
  wie `jsqr`/`@zxing/library` bzw. für 1D-Barcodes einem Barcode-Reader).
  Konkrete Karten­inhalte werden hier **bewusst nicht dokumentiert**
  (persönliche Daten, öffentliches Repo); sie liegen nur lokal auf den Geräten.
  Merkmale je Händler:
  - **Lidl** (QR): gedruckte Kartennummer **plus** eine zusätzliche Prüfziffer.
  - **Payback** (Barcode, CODE128/EAN-13): die 13-stellige Payback-Nummer.
  - **dm** (QR): langer kombinierter Token (dm + Payback) → **kann zeitlich
    rotieren**; falls er an der Kasse nicht mehr geht, neuen Screenshot dekodieren.
  - **REWE** (QR): strukturierter Loyalty-Payload mit der Treue-Nummer.
- **UI:** Akkordeon – nur eine Karte offen (erste per Default), Klick klappt um.
  Löschen sitzt in der farbigen Titelleiste. QR/Barcode werden auf **weißem**
  Grund gerendert (unabhängig vom Dark Mode scannbar).
- **Schließen des Overlays:** X-Button, Swipe nach unten im oberen Bereich (greift
  ab Leiste oder wenn der Inhalt ganz oben steht, Schwelle ~90 px), oder Klick auf
  die leere Fläche.
- **Keine echten Nummern committen** (siehe Datenschutz-Hinweis oben): Platzhalter
  im Formular generisch halten; die tatsächlichen Karten liegen nur lokal.

---

## 8. Feature-Details (Verhalten)

- **Dark Mode:** echtes Schwarz, folgt automatisch `prefers-color-scheme`
  (kein Umschalter). Farben ausschließlich über CSS-Tokens (`tokens.css`);
  `useTheme.js` setzt `data-theme` am `<html>` und die `theme-color`-Meta.
- **Layout:** Gesamtseite nicht scrollbar/wippend (`body { overflow:hidden;
  overscroll-behavior:none }`), nur der Listenbereich scrollt; Suchleiste unten
  fix. **Zoom deaktiviert** (Viewport `user-scalable=no` + Abfangen von
  Pinch-Gesten/Doppeltipp in `main.jsx`).
- **Liste:** offene und erledigte Artikel **nach Kategorie gruppiert**
  (Überschriften ohne Emoji, in Kategorie-Reihenfolge). Erledigte per
  „Erledigte entfernen & verbuchen“ in den Kaufverlauf überführen.
- **Artikel entfernen:** ×-Button **oder Swipe nach links** (`ListItem.jsx`,
  Schwelle ~80 px; vertikales Scrollen bleibt möglich).
- **Suche/Autocomplete:** Vorschläge erscheinen **schon beim Fokus** (leere
  Eingabe) – angeführt von den **häufigsten** Artikeln aus dem Verlauf, dann
  Favoriten, dann Basisliste; beim Tippen Teilstring-Filter. Dropdown öffnet nach
  oben. Priorisierung/Logik in `lib/suggestions.js`.
- **Häufig-gekauft-Chips:** horizontale, scrollbare Leiste oben; Artikel per Tap
  hinzufügen, per × aus dem Verlauf entfernen (`FrequentChips.jsx`).
- **Icons:** Emoji je Produkt/Kategorie (in `products.json`), Auflösung Produkt →
  Kategorie → Standard `🛒` in `lib/icons.js` (`getItemEmoji`).

---

## 9. Produktdaten erweitern

`src/data/products.json`:

```json
{ "name": "Sojaschnetzel", "category": "proteine", "emoji": "🌱" }
```

- `category` referenziert eine `id` aus dem `categories`-Array.
- `emoji` optional – ohne wird das Kategorie-Emoji genutzt.
- Namen müssen eindeutig sein (Verlauf/Autocomplete deduplizieren über den Namen).

Zum Prüfen (Duplikate/ungültige Kategorien) eignet sich ein kurzes Node-Snippet
über `products.json` (Namen normalisieren, Kategorien gegen `categories` prüfen).

---

## 10. Bekannte Einschränkungen & Ideen

- **Suche = Teilstring**, nicht fehlertolerant („schamp“ findet „Champignons“
  nicht). Fuzzy-Suche wäre eine mögliche Erweiterung.
- **dm-Kartentoken** ist evtl. dynamisch (siehe §7).
- **Kundenkarten sind gerätelokal** – kein Sync (bewusst, Datenschutz). Sync
  wäre nur mit echtem Login sinnvoll.
- **`npm audit`** meldet eine Dev-Server-Warnung (esbuild, transitiv über Vite 5).
  Betrifft nur den lokalen Dev-Server, nicht das ausgelieferte Bundle.
- **Kein automatisiertes Test-Setup** im Repo. Verifikation erfolgte manuell
  (Build + Browser). Bei Ausbau: Vitest/Playwright ergänzen.
- **PWA-Icons** unter `public/icons/` sind Platzhalter („L“-Monogramm).

---

## 11. Häufige Aufgaben – kurz

- **Neues Produkt:** Eintrag in `src/data/products.json`.
- **Farbe/Look ändern:** Tokens in `src/styles/tokens.css`.
- **Frische, leere geteilte Liste:** `LIST_ID` in `supabaseConfig.js` ändern.
- **Anderes Supabase-Projekt:** neues Projekt anlegen, `schema.sql` ausführen,
  URL + anon-Key in `supabaseConfig.js` eintragen.
- **Deploy anstoßen:** einfach pushen (Workflow läuft automatisch).
- **Neue localStorage-Migration:** siehe §12.

---

## 12. localStorage-Schema & Migrationen

Der lokale Speicher ist **explizit versioniert** (`listly.schemaVersion`). Beim
App-Start ruft `src/main.jsx` **vor dem ersten Datenzugriff** `runMigrations()`
aus **`src/lib/schema.js`** auf. Die Pipeline ist **idempotent** und **defensiv**:

- **Startversion:** vorhandene Version · `0` (Altdaten ohne Versions-Key) ·
  `SCHEMA_VERSION` (frische Installation ohne Daten).
- **Migrationsschritte** (`MIGRATIONS`) laufen der Reihe nach, jeder **genau
  einmal** (Versions-Gate) – ein erneuter Start wendet sie nicht doppelt an.
- **Version 1** = das bestehende Datenmodell (items, favorites, history, cards,
  theme). Der v0→v1-Schritt ist bewusst identisch (keine Strukturänderung).
- **Version 2** = Artikel um die optionalen Felder `quantity` (positive Zahl oder
  entfällt), `unit` (kurze Zeichenkette, getrimmt/begrenzt) und `note`
  (getrimmt/begrenzt) erweitert. Additiv und rückwärtskompatibel: Altartikel
  bleiben unverändert gültig, leere Felder werden **nicht** materialisiert
  (omit-empty). Normalisierung/Begrenzung erledigt `sanitizeItems` (siehe
  `lib/itemFields.js`).
- **Defensive Validierung:** je Domäne ein reiner *Sanitizer*. Beschädigte Werte
  fallen **isoliert** auf einen sicheren Standard zurück (nie der ganze Speicher);
  **unbekannte Zusatzfelder bleiben erhalten**. Karten (`cards`) sind reine
  Durchreiche (sensible, gerätelokale Daten – nur Nicht-Objekte werden verworfen).
- **Zukünftige, höhere Version** im Speicher → die Pipeline fasst nichts an
  (kein Downgrade).
- Es werden **nur geänderte Keys** zurückgeschrieben; gültige Daten bleiben
  byte-identisch → **kein sichtbares Verhalten ändert sich**.

**Eine neue Migration hinzufügen** (`src/lib/schema.js`):

1. `SCHEMA_VERSION` um 1 erhöhen.
2. In `MIGRATIONS` einen Schritt `{ version, describe, migrate }` ergänzen.
   `migrate(state)` erhält ein Snapshot-Objekt
   `{ items, favorites, history, cards, theme }` und gibt ein neues zurück –
   **pure** (keine Seiteneffekte, kein direkter localStorage-Zugriff).
3. Schritt **idempotent/defensiv** halten (eine beschädigte Versionsmarke kann
   eine erneute Anwendung auslösen).
4. Falls Felder neu/geändert: passenden **Sanitizer** anpassen.
5. **Test** in `src/lib/__tests__/schema.test.js` ergänzen (Vorlagen: leerer
   Speicher, Altdaten ohne Version, Teil­beschädigung, Mehrfachlauf, Zukunfts­version).
