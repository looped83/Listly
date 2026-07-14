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
- **Bedienung:** einheitlicher, einkaufsorientierter Look; Hinzufügen über einen
  schwebenden Plus-Button, der ein **oben angedocktes** Sheet mit Suche +
  Detailfeldern öffnet (bleibt über der eingeblendeten Tastatur sichtbar).
  Zeilen-Aktionen (Favorit/Bearbeiten/Löschen) per Swipe nach links (per Tastatur
  fokussierbar);
  Bearbeiten klappt die Kachel **inline** auf (kein Overlay).
- **Feedback:** zentrale Toast-/aria-live-Infrastruktur mit Undo für Löschen/
  Abschließen; Bottom-Sheet für den Einkaufsabschluss, Inline-Editor für die
  Artikel-Bearbeitung (Menge/Einheit/Notiz/Kategorie)

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
├── App.jsx                 # Orchestrierung: State, Header, Liste, FAB, Overlays/Dialoge
├── main.jsx                # Einstieg, ErrorBoundary, Zoom-Sperre (Gesten)
├── components/
│   ├── AddItemSheet.jsx    #   Hinzufügen-Bottom-Sheet: Suche + Chips + Detailfelder (über FAB)
│   ├── FrequentChips.jsx   #   „Häufig gekauft“-Chips (im Hinzufügen-Sheet)
│   ├── ShoppingList.jsx    #   Liste, nach Kategorie gruppiert (offen + erledigt), Fortschritt
│   ├── ListItem.jsx        #   Einzelzeile: großer Umschalt-Button, Swipe-Aktionen (fokussierbar), Inline-Bearbeitung
│   ├── ItemEditInline.jsx  #   Artikel INLINE in der aufgeklappten Kachel bearbeiten (kein Overlay)
│   ├── ProductIcon.jsx     #   rendert das Emoji eines Artikels
│   ├── SyncStatus.jsx      #   Live/Verbinde/Offline-Anzeige (oben rechts)
│   ├── Toast.jsx           #   Snackbar-Anzeige + aria-live-Regionen (polite/assertive)
│   ├── CheckoutDialog.jsx  #   „Einkauf abschließen“-Bottom-Sheet
│   ├── CardsSheet.jsx      #   Kundenkarten-Overlay (Akkordeon) – via React.lazy geladen
│   └── CodeImage.jsx       #   <QRCode> und <Barcode> (qrcode / jsbarcode)
├── hooks/
│   ├── useLocalStorage.js  #   State ↔ localStorage (Persistenz als Effekt, StrictMode-sicher)
│   ├── useShoppingItems.js #   Liste: Supabase (Echtzeit) ODER lokal, inkl. aller Operationen
│   ├── useToast.jsx        #   ToastProvider/useToast – zentrale Statusmeldungen + Undo
│   ├── useDialogFocus.js   #   Fokusfalle/Escape/initialer Fokus/Fokusrückgabe für Dialoge/Sheets
│   ├── useSwipeReveal.js   #   Wisch-Geste „aufdecken“ (Zeilen-Aktionen): Gesten-State + Prop-Bündel
│   └── useTheme.js         #   automatischer Dark Mode (prefers-color-scheme)
├── lib/
│   ├── storage.js          #   localStorage-Keys + read/write
│   ├── supabase.js         #   Supabase-Client, lazy per dynamischem Import (getSupabase)
│   ├── supabaseConfig.js   #   ← URL, anon-Key, LIST_ID
│   ├── history.js          #   Kaufverlauf (Häufigkeit verbuchen)
│   ├── suggestions.js      #   Autocomplete: Kandidaten (Verlauf/Favorit/Basis) + Scoring
│   ├── textMatch.js        #   reine Helfer: Normalisierung + deterministisches Trefferscoring
│   ├── icons.js            #   Emoji-Auflösung + Kategorie-Infos/-Optionen
│   ├── cards.js            #   Händler-Metadaten, Barcode-Format, Code-Inhalt
│   ├── checkout.js         #   reine Helfer: Zusammenfassung/Auswahl beim Einkaufsabschluss
│   ├── itemFields.js       #   reine Helfer: Menge/Einheit/Notiz (Coerce/Parse/Format)
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
  Grund gerendert (unabhängig vom Dark Mode scannbar). Barcodes (z. B. Payback)
  werden bewusst **groß** dargestellt (`CodeImage.jsx`: `height` 110, `width` 3;
  CSS `.code__barcode` mit `height: auto`, `max-width: 440px`), damit der
  Kassen-Scanner sie zuverlässig vom Display liest.
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
  overscroll-behavior:none }`), nur der Listenbereich scrollt. Es gibt **keine
  feste Eingabeleiste** mehr; Hinzufügen läuft über einen **schwebenden
  Plus-Button (FAB)** unten rechts (`.fab`). **Pinch-Zoom bleibt erlaubt**
  (WCAG 1.4.4 – keine `user-scalable=no`-Sperre); nur der versehentliche
  **Doppeltipp-Zoom** ist per CSS `touch-action: manipulation` unterbunden.
- **Einheitlicher Einkaufs-Look (kein Modus-Umschalter):** die App hat **eine**
  Standardansicht – große, leicht treffbare Zeilen, erledigte Artikel
  standardmäßig eingeklappt. (Der frühere Plan/Shop-Umschalter und das
  Bildschirm-wachhalten wurden dabei entfernt.)
- **Liste:** offene und erledigte Artikel **nach Kategorie gruppiert**
  (Überschriften ohne Emoji, in Kategorie-Reihenfolge aus `products.json`).
  Gruppierung in `lib/groupItems.js` (`groupByCategory`, pure Funktion): leere
  Kategorien entfallen, unbekannte/fehlende Kategorien landen gemeinsam zuletzt
  unter „Sonstiges“, die Reihenfolge innerhalb einer Kategorie bleibt stabil. Die
  **Artikelanzahl steht direkt hinter dem Kategorienamen** („Obst & Gemüse · 3“);
  ein `aria-label` liefert Screenreadern den vollständigen Satz („Obst & Gemüse,
  3 Artikel“). Kompakte Anzeige inkl. optionaler Menge/Einheit („2 × Hafermilch“,
  „500 g Mehl“) und Notizzeile darunter – beide nur, wenn tatsächlich gesetzt
  (kein leerer Platzhalter).
- **Fortschritt & Erledigt (`ShoppingList.jsx`):** ein **Fortschrittsbalken**
  „x von y erledigt" (`role="progressbar"`, aus `summarizeCheckout`) erscheint
  **erst, sobald der erste Artikel abgehakt wurde** (`checkedCount > 0`). Die
  **erledigten Artikel** sind standardmäßig **eingeklappt** (Disclosure,
  `aria-expanded`); die primäre Aktion „Einkauf abschließen“ bleibt auch dann
  erreichbar.
- **Zeile (`ListItem.jsx`):** Icon + Name bilden **einen** großen,
  tastaturbedienbaren Umschalt-Button (`aria-pressed`), kein verschachteltes
  `<button>`. **Swipe nach links** (rechts→links) deckt hinter der Zeile eine
  Aktionsleiste mit **Favorit / Bearbeiten / Löschen** auf (rastet ab ~56 px
  ein, `REVEAL_WIDTH` 156 px; vertikales Scrollen bleibt möglich, ein Klick
  außerhalb schließt wieder). Ein separates „Mehr"-Menü (⋯) gibt es **nicht mehr**
  – die drei Aktions-Buttons bleiben aber fokussierbar (kein `aria-hidden`),
  sodass sie **ohne Geste per Tastatur/Screenreader** erreichbar sind: erhält
  einer den Fokus, klappt die Leiste automatisch auf; verlässt der Fokus sie,
  schließt sie wieder. Die komplette Gesten-/Aufdeck-Logik steckt im Hook
  `useSwipeReveal` – die Zeile selbst bleibt rein präsentational und spreadet nur
  die gelieferten Prop-Bündel (`rowProps`/`actionsProps`).
- **Artikel hinzufügen (`AddItemSheet.jsx`, geöffnet über den FAB):** ein
  **oben angedocktes** Sheet (`.dialog--top`, damit es auf Mobilgeräten nicht von
  der Tastatur verdeckt wird) mit **Produktsuche** (Autovervollständigung), den
  **Häufig-gekauft-Chips** und **allen Detailfeldern** (Menge, Einheit, Kategorie,
  Notiz – Notiz kompakt einzeilig) in einem Schritt. Interaktion: ein **Chip**
  fügt sofort hinzu (Sheet bleibt offen für Folge-Adds), ein **Vorschlag**
  übernimmt Name + Kategorie ins Formular (zum Ergänzen von Details),
  **„Hinzufügen"** übernimmt Name + Details. Die Vorschlagsauswahl greift auf
  **`pointerdown`** (nicht `click`) mit `preventDefault`: so wird schon der
  **erste** Antippen zuverlässig übernommen, bevor Fokuswechsel/Tastatur einen
  Layoutsprung auslösen (behebt „erstes Produkt lässt sich nicht auswählen").
  Nach dem Hinzufügen bleibt das Sheet offen (Felder geleert, Suche fokussiert);
  Schließen über X/Abbrechen/Escape/Backdrop. Barrierefreiheit über
  `useDialogFocus` (Fokusfalle, Escape, initialer Fokus auf der Suche,
  Fokusrückgabe an den FAB).
- **Hinzufügen-Ergebnis:** `addItem` (im Hook) liefert ein eindeutiges Ergebnis
  (`added` / `alreadyOpen` / `reactivated` / `invalid`) statt still zu bleiben –
  identisch für Suche, Vorschlag und Chip. Bei einer Dublette (Name case-/
  whitespace-insensitiv gleich) wird **nicht** dupliziert: ein bereits offener
  Artikel bleibt unverändert, ein bereits erledigter wird reaktiviert (wieder
  offen). Feedback über die Toast-Infrastruktur.
- **Artikel bearbeiten (inline, kein Overlay):** der Stift-Eintrag der Wisch-
  Leiste klappt die Kachel **direkt an Ort und Stelle** auf und
  zeigt `ItemEditInline.jsx` (Name, Menge, Einheit, Kategorie, Notiz) inline –
  gesteuert über `editingId` in `App.jsx`, das an `ShoppingList` → `ListItem`
  durchgereicht wird (`isEditing`). Die **Notiz** ist ein kompaktes einzeiliges
  Feld (keine seitenweite Textfläche mehr). Validierung: Name darf nicht leer
  sein, Menge muss eine positive Zahl sein (Komma **und** Punkt als
  Dezimaltrennzeichen werden akzeptiert), Einheit/Notiz werden getrimmt und
  begrenzt (`MAX_UNIT_LENGTH`/`MAX_NOTE_LENGTH` in `lib/itemFields.js`). Führt
  das Umbenennen zu einem Namenskonflikt mit einem anderen Artikel, fragt der
  Editor eine **bewusste Zusammenführung** ab (kein stilles Duplikat): der
  bearbeitete Artikel gewinnt (behält `id`/Position/`checked`), der andere
  wird entfernt; ein vorhandener Favorit folgt der Umbenennung. Der Editor ist
  nicht modal (Teil der Seite), fokussiert beim Aufklappen das Namensfeld und
  bricht per Escape ab.
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
  `CheckoutDialog` und `AddItemSheet` – Fokusfalle (Tab/Shift+Tab zirkulieren
  im Panel), Escape schließt, initialer Fokus beim Öffnen, Fokusrückgabe an das
  auslösende Element beim Schließen. Der Inline-Editor (`ItemEditInline`) ist
  **nicht modal** und nutzt daher keine Fokusfalle – nur initialen Fokus + Escape.
- **Suche/Autocomplete (`lib/suggestions.js` + `lib/textMatch.js`):** Kandidaten
  stammen – dedupliziert – aus Kaufverlauf (nach Häufigkeit), Favoriten und
  Basisliste; diese Reihenfolge ist die Herkunftspriorität. Die Bewertung ist
  **deterministisch und nachvollziehbar** (keine externe Such-/„KI"-Bibliothek):
  Trefferstufen **exakt › Synonym › Präfix › Token-Präfix › Teilstring ›
  Singular/Plural › Fuzzy**. `textMatch.normalizeText` macht Groß-/Kleinschreibung,
  Diakritika und Umlaut-Schreibweisen robust (**„ä" ≡ „a" ≡ „ae"**), `stemDe`
  deckt einfache Plurale ab, eine kleine explizite Synonymliste bildet z. B.
  „oat milk" → „Hafermilch". Fuzzy (Sellers-Editierdistanz) nur ab 4 Zeichen mit
  strenger Schwelle. Ergebnis stabil sortiert, dedupliziert, auf 6 begrenzt. Bei
  leerer Eingabe führen die häufigsten Verlaufsartikel. Wird im Hinzufügen-Sheet
  genutzt (§ „Artikel hinzufügen").
- **Häufig-gekauft-Chips (`FrequentChips.jsx`):** die meistgekauften
  Verlaufsartikel, die nicht schon auf der Liste stehen – als scrollbare
  Chip-Leiste **im Hinzufügen-Sheet**. Tap fügt hinzu, das × entfernt den Artikel
  aus dem Verlauf.
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

- **Suche:** deterministisches Trefferscoring (siehe §8, `lib/textMatch.js`), aber
  **keine** vollständige natürlichsprachliche Eingabe (z. B. „2 Äpfel und Milch“
  in einem Feld); Menge/Einheit werden im Hinzufügen-Sheet über eigene Felder
  erfasst, nicht aus dem Suchtext geparst.
- **`lib/quickInput.js` wurde entfernt (war nicht mehr verdrahtet):** der Parser
  („2 hafermilch" → `{ name, quantity, … }`) wurde von der früheren, entfernten
  `AddItemForm` genutzt; das Hinzufügen-Sheet verwendet explizite Detailfelder.
  Modul + Tests liegen bei Bedarf in der Git-Historie.
- **Bildschirm-wachhalten entfernt:** mit dem Wegfall des Einkaufsmodus gibt es
  kein Screen-Wake-Lock mehr. Bei Bedarf als kleine, bewusste Einstellung
  wieder aufnehmbar (früherer `useWakeLock`-Hook ist in der Git-Historie).
- **Keine Mengen-Zusammenrechnung:** eine Zusammenführung beim Umbenennen
  (siehe §8) summiert Mengen bewusst **nicht** (Einheiten könnten
  unterschiedlich/inkompatibel sein) – der bearbeitete Artikel gewinnt.
- **dm-Kartentoken** ist evtl. dynamisch (siehe §7).
- **Kundenkarten sind gerätelokal** – kein Sync (bewusst, Datenschutz). Sync
  wäre nur mit echtem Login sinnvoll.
- **`npm audit`** meldet eine Dev-Server-Warnung (esbuild, transitiv über Vite 5).
  Betrifft nur den lokalen Dev-Server, nicht das ausgelieferte Bundle.
- **Tests:** Vitest + React Testing Library, `npm test` (254 Tests, 15 Dateien).
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
- **Synonym/Suchverhalten anpassen:** `SYNONYM_SOURCE` bzw. die Scoring-Regeln in
  `src/lib/textMatch.js` erweitern; tabellengetriebene Tests in
  `src/lib/__tests__/textMatch.test.js` / `suggestions.test.js` ergänzen.
- **Feld im Hinzufügen-Sheet ändern:** `src/components/AddItemSheet.jsx`
  (Suche + Chips + Detailfelder). Die eigentliche Anlege-Logik/Dubletten liegt in
  `useShoppingItems.addItem`; App-Verdrahtung (Toast, Sheet öffnen) in `App.jsx`.
- **Neues Artikelfeld (wie Menge/Einheit/Notiz):** Sanitizer in `schema.js`
  erweitern + `SCHEMA_VERSION` hochzählen (§12), Coerce-Helfer in
  `lib/itemFields.js` ergänzen, `ItemEditInline.jsx` (und ggf. `AddItemSheet.jsx`)
  um das Feld erweitern,
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
