# Listly – Handover

Stand: Juli 2026 (aktueller Branch-Tip, `claude/feedback-undo-infrastructure-3aebrv`).
Diese Datei fasst Architektur, Betrieb und Besonderheiten zusammen, damit jemand
die Weiter­ent­wicklung ohne Vorwissen übernehmen kann.

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
- **Default-Branch:** `main` (Deploy-Quelle) · **Arbeitsbranch:**
  `claude/feedback-undo-infrastructure-3aebrv`
- **Geteilte Liste:** in Echtzeit über Supabase synchronisiert
- **Kundenkarten:** Lidl/Payback/dm/REWE mit QR/Barcode, rein lokal gespeichert
- **Feedback:** zentrale Toast-/aria-live-Infrastruktur mit Undo für Löschen/
  Abschließen; ein Bottom-Sheet-Dialog für den Einkaufsabschluss und einer für
  die Artikel-Bearbeitung (Menge/Einheit/Notiz/Kategorie)

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
├── App.jsx                 # Orchestrierung: State, Header, Liste, Dock, Overlays/Dialoge
├── main.jsx                # Einstieg, ErrorBoundary, Zoom-Sperre (Gesten)
├── components/
│   ├── AddItemForm.jsx     #   Suchfeld + Autovervollständigung (öffnet nach oben)
│   ├── FrequentChips.jsx   #   „Häufig gekauft“-Chips (oben angeheftet, scrollbar)
│   ├── ShoppingList.jsx    #   Liste, nach Kategorie gruppiert (offen + erledigt)
│   ├── ListItem.jsx        #   Einzelzeile: Umschalt-Button, Favorit/Bearbeiten/Löschen, Swipe
│   ├── ProductIcon.jsx     #   rendert das Emoji eines Artikels
│   ├── SyncStatus.jsx      #   Live/Verbinde/Offline-Anzeige (oben rechts)
│   ├── Toast.jsx           #   Snackbar-Anzeige + aria-live-Regionen (polite/assertive)
│   ├── CheckoutDialog.jsx  #   „Einkauf abschließen“-Bottom-Sheet
│   ├── ItemEditDialog.jsx  #   Artikel bearbeiten (Name/Menge/Einheit/Kategorie/Notiz)
│   ├── CardsSheet.jsx      #   Kundenkarten-Overlay (Akkordeon) – via React.lazy geladen
│   └── CodeImage.jsx       #   <QRCode> und <Barcode> (qrcode / jsbarcode)
├── hooks/
│   ├── useLocalStorage.js  #   State ↔ localStorage (Persistenz als Effekt, StrictMode-sicher)
│   ├── useShoppingItems.js #   Liste: Supabase (Echtzeit) ODER lokal, inkl. aller Operationen
│   ├── useToast.jsx        #   ToastProvider/useToast – zentrale Statusmeldungen + Undo
│   ├── useDialogFocus.js   #   Fokusfalle/Escape/initialer Fokus/Fokusrückgabe für Dialoge
│   └── useTheme.js         #   automatischer Dark Mode (prefers-color-scheme)
├── lib/
│   ├── storage.js          #   localStorage-Keys + read/write
│   ├── supabase.js         #   Supabase-Client, lazy per dynamischem Import (getSupabase)
│   ├── supabaseConfig.js   #   ← URL, anon-Key, LIST_ID
│   ├── history.js          #   Kaufverlauf (Häufigkeit verbuchen)
│   ├── suggestions.js      #   Autocomplete- & Chip-Logik
│   ├── icons.js            #   Emoji-Auflösung + Kategorie-Infos/-Optionen
│   ├── cards.js            #   Händler-Metadaten, Barcode-Format, Code-Inhalt
│   ├── checkout.js         #   reine Helfer: Zusammenfassung/Auswahl beim Einkaufsabschluss
│   ├── itemFields.js       #   reine Helfer: Menge/Einheit/Notiz (Coerce/Parse/Format)
│   ├── quickInput.js       #   reiner Parser: Schnelleingabe → { name, quantity, unit, note }
│   ├── groupItems.js       #   reine Helfer: Artikel nach Kategorie gruppieren (Sonstiges zuletzt)
│   └── schema.js           #   localStorage-Migrationen + Sanitizer (siehe §12)
├── data/products.json      # 356 Produkte / 16 Kategorien (Emoji je Produkt)
├── styles/
│   ├── tokens.css          #   Design-Tokens Light + Dark (true black)
│   └── index.css           #   Base + alle Komponenten-Styles
└── assets/fonts/           # lokal gehostete woff2 + fonts.css (OFL)

.github/workflows/deploy.yml # Test + Build + offizielle GitHub-Pages-Actions-Pipeline
supabase/schema.sql          # Tabelle + Spalten + RLS + Realtime für die geteilte Liste
```

---

## 4. Datenmodell & Speicherung

Alle Keys in `src/lib/storage.js` (`STORAGE_KEYS`).

| Ort            | Key/Tabelle        | Inhalt                                                              |
| -------------- | ------------------ | ------------------------------------------------------------------- |
| **Supabase**   | Tabelle `list_items` | Geteilte Liste: `{ id, list_id, name, category, checked, created_at, quantity?, unit?, note? }` |
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

Artikel-Objekt (in App/State):
`{ id, name, category, checked, createdAt, quantity?, unit?, note? }`.
`category` ist eine Kategorie-`id` aus `products.json` (oder `null` → „Sonstiges“).
`quantity` (positive Zahl), `unit` und `note` (kurze Zeichenketten) sind
**optional** – fehlen sie, wird nichts angezeigt (kein leerer Platzhalter).
Normalisierung/Begrenzung: `lib/itemFields.js` (siehe §8, §12).

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
  `addItem`, `toggleItem`, `updateItem`, `removeItem`, `restoreItems` (Undo) und
  `completeCheckout` (Einkaufsabschluss, s. §8). Bei Fehlern wird neu geladen
  (`refetch`).
- **Schema:** `supabase/schema.sql` (idempotent). Legt Tabelle + die optionalen
  Spalten `quantity`/`unit`/`note` an (`add column if not exists`), aktiviert
  `REPLICA IDENTITY FULL` (nötig, damit Realtime-DELETE mit `list_id`-Filter
  funktioniert), RLS mit einer permissiven anon-Policy und die Realtime-
  Publikation. Bei einem neuen Supabase-Projekt (oder nach einem Spalten-Update
  wie den neuen Feldern) einmal im SQL-Editor ausführen – idempotent, also auch
  auf einer bestehenden Tabelle gefahrlos erneut ausführbar. `rowToItem` liest
  die neuen Spalten defensiv (funktioniert auch, falls das Skript noch nicht
  erneut gelaufen ist – dann bleiben die Felder nur ungesetzt).
- **Zugriffsmodell „offener geteilter Link“:** kein Login. URL, anon-Key und
  `LIST_ID` stecken im ausgelieferten Bundle (und im öffentlichen Repo). Wer sie
  kennt, kann die Liste lesen/ändern – für eine Einkaufsliste bewusst akzeptiert.
  **Keine sensiblen Daten in die Liste legen.** Für echten Schutz bräuchte es
  eine Login-Variante (Supabase Auth) + strengere RLS-Policies.

Status-Anzeige oben rechts (`SyncStatus.jsx`): `live` (verbunden), `connecting`,
`error` (offline), `local` (kein Cloud-Sync konfiguriert).

---

## 6. Deployment (GitHub Pages)

> ⚠️ **Wichtigste Regel:** Es wird **ausschließlich bei Push auf `main`**
> deployt. Ein Push auf einen Feature-/Arbeitsbranch (auch mit gemergtem PR
> darauf) löst **kein** Deployment aus und ändert die Live-Seite **nicht**.
> Damit Änderungen sichtbar werden, muss der PR nach `main` **gemergt**
> werden – der Merge-Commit auf `main` startet die Pipeline automatisch.

Automatisch via **`.github/workflows/deploy.yml`**, offizielle
GitHub-Pages-Actions-Pipeline (kein `gh-pages`-Branch mehr, kein committetes
Build-Artefakt):

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

1. `npm ci`
2. **`npm test`** – schlägt ein Test fehl, bricht der Workflow ab und es wird
   **nicht** deployt.
3. `npm run build` → `dist/`
4. `dist/` als Pages-Artefakt hochladen (`upload-pages-artifact`) und über
   `deploy-pages` veröffentlichen.

**Einmalige Repo-Einstellung:** Settings → Pages → Build and deployment →
Source = **„GitHub Actions“**.

**Manuell anstoßen:** Actions-Tab → „Deploy to GitHub Pages“ →
„Run workflow“ (`workflow_dispatch`), z. B. um ohne neuen Commit erneut zu
deployen.

**Troubleshooting „ich sehe meine Änderung nicht“:**
1. Prüfen, ob der Commit tatsächlich auf `origin/main` liegt
   (`git log --oneline -1 origin/main`), nicht nur auf einem Feature-Branch.
2. Im Actions-Tab prüfen, ob der zugehörige „Deploy to GitHub Pages“-Lauf
   grün ist (ein roter Testfehler verhindert das Deployment stillschweigend
   für den Browser-Nutzer – im Actions-Log aber sichtbar).
3. Nach erfolgreichem Deploy auf dem Gerät einmal **hart neu laden** (Service
   Worker: der Workbox-Cache wird via
   `cleanupOutdatedCaches/skipWaiting/clientsClaim` erneuert, das kann eine
   sichtbare Verzögerung von einem Reload verursachen).

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
  (Überschriften ohne Emoji, in Kategorie-Reihenfolge aus `products.json`).
  Gruppierung in `lib/groupItems.js` (`groupByCategory`, pure Funktion): leere
  Kategorien entfallen, unbekannte/fehlende Kategorien landen gemeinsam zuletzt
  unter „Sonstiges“, die Reihenfolge innerhalb einer Kategorie bleibt stabil. Jede
  Kategorie-Überschrift zeigt zusätzlich die Artikelanzahl (visuelles Badge) und
  trägt ein `aria-label` mit vollständigem Satz („Obst & Gemüse, 3 Artikel“) für
  Screenreader. Kompakte Anzeige inkl.
  optionaler Menge/Einheit („2 × Hafermilch“, „500 g Mehl“) und Notizzeile
  darunter – beide nur, wenn tatsächlich gesetzt (kein leerer Platzhalter).
- **Zeile (`ListItem.jsx`):** Icon + Name bilden **einen** tastaturbedienbaren
  Umschalt-Button (`aria-pressed`), kein verschachteltes `<button>`. Favorit,
  Bearbeiten (Stift) und Löschen sind eigene Buttons mit ≥ 44×44 px
  Trefferfläche. Zusätzlich **Swipe nach links** zum Löschen (Schwelle ~80 px;
  vertikales Scrollen bleibt möglich).
- **Artikel hinzufügen:** `addItem` liefert ein eindeutiges Ergebnis
  (`added` / `alreadyOpen` / `reactivated` / `invalid`) statt still zu bleiben –
  identisch für Tippen, Autovervollständigung und Häufig-gekauft-Chips. Bei
  einer Dublette (Name case-/whitespace-insensitiv gleich) wird **nicht**
  dupliziert: ein bereits offener Artikel bleibt unverändert, ein bereits
  erledigter wird reaktiviert (wieder offen). Feedback über die Toast-
  Infrastruktur, Fokus bleibt im Eingabefeld.
- **Schnelleingabe (`lib/quickInput.js`):** beim **manuellen** Absenden von
  Freitext zerlegt `parseQuickInput` die Eingabe konservativ in
  `{ name, quantity, unit, note }`. Erkannt werden nur eindeutige Präfixmuster:
  Multiplikator (`2x`/`2 ×`), Menge + bekannte Einheit (`500 g`, `1,5 l`) und reine
  Ganzzahl-Anzahl (`3 Bananen`); `#` trennt eine Notiz ab (`Tofu #geräuchert`).
  Im Zweifel bleibt die ganze Eingabe der Name – Produktnamen mit Zahlen (`0%
  Joghurt`, `7Up`, `3-Minuten-Terrine`) werden nicht zerlegt. Einheiten werden auf
  kanonische Kürzel normalisiert (Liste `QUICK_UNIT_ALIASES`, nur Maßeinheiten).
  **Nur Freitext** wird geparst – ausgewählte Vorschläge/Chips behalten ihre
  Metadaten. Die Dubletten-Erkennung läuft unverändert über den reinen Namen; ein
  neuer Toast zeigt die interpretierte Menge kompakt (`itemLabel`). Nur bei einem
  **neu** angelegten Artikel werden die Felder gesetzt (omit-empty).
- **Artikel bearbeiten:** Stift-Button öffnet `ItemEditDialog.jsx` (Name,
  Menge, Einheit, Kategorie, Notiz). Validierung: Name darf nicht leer sein,
  Menge muss eine positive Zahl sein (Komma **und** Punkt als
  Dezimaltrennzeichen werden akzeptiert), Einheit/Notiz werden getrimmt und
  begrenzt (`MAX_UNIT_LENGTH`/`MAX_NOTE_LENGTH` in `lib/itemFields.js`). Führt
  das Umbenennen zu einem Namenskonflikt mit einem anderen Artikel, fragt der
  Dialog eine **bewusste Zusammenführung** ab (kein stilles Duplikat): der
  bearbeitete Artikel gewinnt (behält `id`/Position/`checked`), der andere
  wird entfernt; ein vorhandener Favorit folgt der Umbenennung.
- **Einkauf abschließen:** `CheckoutDialog.jsx` (Bottom-Sheet) ersetzt die
  frühere „Erledigte entfernen & verbuchen“-Aktion. Zeigt Anzahl
  abgehakter/offener Artikel und die Konsequenz; Standard verbucht nur
  Abgehaktes in den Kaufverlauf und entfernt es (offene Artikel bleiben
  stehen), optional bewusst „Alle als gekauft abschließen“. Erscheint nur,
  wenn mindestens ein Artikel abgehakt ist. Nach dem Abschluss bietet ein
  Toast **Undo** (stellt Liste **und** Kaufverlauf vollständig wieder her).
- **Feedback & Undo (`useToast.jsx`, `Toast.jsx`):** zentrale Snackbar-
  Infrastruktur, ohne UI-Bibliothek. Normale Meldungen sind `aria-live="polite"`,
  echte Fehler `aria-live="assertive"`. Auto-Dismiss pausiert bei Hover/Fokus;
  Undo-Aktionen sind per Tastatur erreichbar. Aktuell genutzt für: Artikel
  löschen, Einkauf abschließen, Artikel bearbeiten/Dublette/Reaktivierung.
- **Dialoge (`useDialogFocus.js`):** gemeinsame Zugänglichkeits-Logik für
  `CheckoutDialog` und `ItemEditDialog` – Fokusfalle (Tab/Shift+Tab zirkulieren
  im Panel), Escape schließt, initialer Fokus beim Öffnen, Fokusrückgabe an das
  auslösende Element beim Schließen.
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

- **Suche:** exakte Teilstring-Treffer stehen oben; reichen sie nicht bis zum
  Limit, füllen tippfehler-tolerante Fuzzy-Treffer auf (Editierdistanz, ab 3
  Zeichen Eingabelänge – siehe `lib/suggestions.js`). Keine vollständige
  natürlichsprachliche Eingabe (z. B. „2 Äpfel und Milch“ in einem Feld).
- **Keine Mengen-Zusammenrechnung:** eine Zusammenführung beim Umbenennen
  (siehe §8) summiert Mengen bewusst **nicht** (Einheiten könnten
  unterschiedlich/inkompatibel sein) – der bearbeitete Artikel gewinnt.
- **dm-Kartentoken** ist evtl. dynamisch (siehe §7).
- **Kundenkarten sind gerätelokal** – kein Sync (bewusst, Datenschutz). Sync
  wäre nur mit echtem Login sinnvoll.
- **`npm audit`** meldet eine Dev-Server-Warnung (esbuild, transitiv über Vite 5).
  Betrifft nur den lokalen Dev-Server, nicht das ausgelieferte Bundle.
- **Tests:** Vitest + React Testing Library, `npm test` (186 Tests, 13 Dateien).
  Läuft auch als Teil der Deploy-Pipeline (§6) – ein Testfehler verhindert das
  Deployment. Kein E2E/Playwright-Setup.
- **PWA-Icons** unter `public/icons/` sind Platzhalter („L“-Monogramm).

---

## 11. Häufige Aufgaben – kurz

- **Neues Produkt:** Eintrag in `src/data/products.json`.
- **Farbe/Look ändern:** Tokens in `src/styles/tokens.css`.
- **Frische, leere geteilte Liste:** `LIST_ID` in `supabaseConfig.js` ändern.
- **Anderes Supabase-Projekt:** neues Projekt anlegen, `schema.sql` ausführen,
  URL + anon-Key in `supabaseConfig.js` eintragen.
- **Deploy anstoßen:** PR nach **`main`** mergen (nur das löst das Deployment
  aus, siehe §6 – Push auf einen Feature-Branch allein reicht nicht).
- **Neue localStorage-Migration:** siehe §12.
- **Schnelleingabe-Einheit ergänzen:** `QUICK_UNIT_ALIASES` in
  `src/lib/quickInput.js` erweitern (Alias → kanonisches Kürzel), Test ergänzen.
- **Neues Artikelfeld (wie Menge/Einheit/Notiz):** Sanitizer in `schema.js`
  erweitern + `SCHEMA_VERSION` hochzählen (§12), Coerce-Helfer in
  `lib/itemFields.js` ergänzen, `ItemEditDialog.jsx` um das Feld erweitern,
  Supabase-Spalte in `schema.sql` (`add column if not exists`) + `rowToItem`
  in `lib/supabase.js` ergänzen.

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
