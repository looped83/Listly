# Listly

Eine schlanke, **vegane Einkaufslisten-PWA** – gebaut mit **Vite + React**, ohne
unnötige Abhängigkeiten. Läuft lokal im Browser und lässt sich als App aufs Handy
installieren (offline-fähig). Optional wird die Liste über Supabase in Echtzeit
zwischen mehreren Geräten geteilt.

## Features

- **Artikel verwalten** – hinzufügen über einen schwebenden Plus-Button (öffnet
  ein oben angedocktes Sheet mit Produktsuche, einem Mengen-Stepper und einer
  Kategorie-Auswahl); nach dem Hinzufügen schließt sich das Sheet. Abhaken durch
  Antippen der ganzen Zeile.
- **Swipe-Aktionen** – Wischen nach links deckt hinter jeder Zeile die Aktionen
  **Favorit / Bearbeiten / Löschen** auf. Dieselben Aktionen sind ohne Geste per
  Tastatur und Screenreader erreichbar (die Leiste klappt bei Fokus automatisch auf).
- **Inline-Bearbeitung** – „Bearbeiten“ klappt die Kachel direkt an Ort und
  Stelle auf (kein Overlay); beim Umbenennen auf einen vorhandenen Artikel gibt
  es eine bewusste Zusammenführungs-Abfrage statt stiller Dubletten.
- **Einkauf abschließen** – ein Bottom-Sheet verbucht abgehakte (optional alle)
  Artikel in den Kaufverlauf und entfernt sie von der Liste – mit **Undo** über
  die zentrale Toast-Infrastruktur.
- **Kaufverlauf** – verbuchte Artikel merken sich ihre Kaufhäufigkeit. Häufig
  gekaufte Artikel erscheinen im Hinzufügen-Sheet als horizontal scrollbare
  Schnellauswahl-Chips (einzeln über ihr ×-Symbol aus den Vorschlägen entfernbar).
- **Autovervollständigung** – deterministisches, nachvollziehbares Trefferscoring
  (exakt › Synonym › Präfix › Token-Präfix › Teilstring › Singular/Plural ›
  Tippfehler), priorisiert nach **Kaufverlauf → Favoriten → veganer Basisliste**.
- **Geteilte Liste (optional)** – in Echtzeit über Supabase synchronisiert
  (Status-Anzeige oben rechts); ohne Konfiguration arbeitet Listly rein lokal.
- **Kundenkarten** – Lidl/Payback/dm/REWE u. a. als QR-/Barcode direkt in der App,
  **rein lokal** auf dem Gerät gespeichert.
- **Vegane Produktdaten** – Kategorien und Produkte (Hafermilch, Tofu,
  Hefeflocken, veganer Käse …) liegen in [`src/data/products.json`](src/data/products.json)
  und sind leicht erweiterbar. Produkt-Symbole sind Emoji (kein Icon-Font nötig);
  UI-Symbole kommen aus [lucide-react](https://lucide.dev).
- **Automatischer Dark Mode** – vollständiges zweites Farbschema über CSS-Tokens
  (keine hartcodierten Farben in den Komponenten). Folgt automatisch der
  Systemeinstellung (`prefers-color-scheme`), ohne manuellen Umschalter.
- **Barrierefrei** – vollständige Tastaturbedienung, Fokusmanagement in allen
  Dialogen/Sheets, aria-live-Statusmeldungen, sichtbare Fokusindikatoren,
  `prefers-reduced-motion` wird respektiert.
- **PWA** – installierbar, Standalone-Modus, Offline-Support via Service Worker.
- **Lokale Fonts** – Fraunces, Inter & IBM Plex Mono sind selbst gehostet
  (kein CDN), für schnelle Ladezeiten und Offline-Fähigkeit.

## Datenmodell

Die geteilte Liste lebt in Supabase (Tabelle `list_items`), sobald Zugangsdaten
konfiguriert sind – sonst in `localStorage`. Alle übrigen Daten bleiben bewusst
lokal pro Gerät:

| Schlüssel              | Inhalt                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| `listly.items`         | Liste (nur im lokalen Modus): `[{ id, name, category, checked, createdAt, quantity? }]` |
| `listly.favorites`     | Favoriten: `["Hafermilch", …]`                                            |
| `listly.history`       | Kaufverlauf: `{ [name]: { name, category, count, lastPurchased } }`        |
| `listly.cards`         | Kundenkarten: `[{ id, retailer, name, code, codeType }]`                   |
| `listly.schemaVersion` | Version des localStorage-Schemas (Migrationen in `src/lib/schema.js`)      |

## Setup

Voraussetzung: **Node.js ≥ 18**.

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Dev-Server starten (http://localhost:5173)
```

> ⚠️ **Weiße Seite?** Die App muss immer über einen Server laufen. Das direkte
> Öffnen der Datei `index.html` bzw. `dist/index.html` per Doppelklick
> (`file://…`) zeigt eine **weiße Seite** – Browser blockieren ES-Module und
> Service Worker über `file://`. Nutze stattdessen `npm run dev` (Entwicklung)
> oder `npm run preview` (gebautes Bundle) und öffne die angezeigte
> `http://localhost:…`-Adresse.

## Build, Test & Vorschau

```bash
npm run build    # Produktions-Build nach dist/
npm run preview  # gebautes Bundle lokal servieren
npm test         # Vitest (Unit-/Komponententests)
npm run lint     # ESLint
```

## Als PWA aufs Handy installieren

1. `npm run build && npm run preview` ausführen (oder `dist/` auf einen Webserver
   mit **HTTPS** deployen – für PWA-Installation außerhalb von `localhost`
   erforderlich).
2. Die Seite im mobilen Browser öffnen.
3. Über das Browser-Menü **„Zum Startbildschirm hinzufügen“ / „App installieren“**
   wählen. Listly startet danach im Standalone-Modus.

## Deployment auf GitHub Pages

Der Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) baut,
**lintet, testet** und veröffentlicht die App bei jedem Push auf `main`
automatisch über die offizielle GitHub-Actions-Pages-Pipeline. Es wird
ausschließlich der frisch gebaute `dist/`-Ordner als Pages-Artefakt hochgeladen –
es gibt keinen `gh-pages`-Branch und kein committetes Build-Artefakt. So
entspricht der veröffentlichte Stand reproduzierbar dem Quellcode auf `main`.

**Einmalige Einstellung** in **Settings → Pages → „Build and deployment”**:

- **Source:** **„GitHub Actions”**

(Kein Branch/Ordner mehr auswählen – die Quelle ist der Workflow.)

Danach ist die App unter `https://<user>.github.io/<repo>/` erreichbar
(z. B. `https://looped83.github.io/Listly/`). Beim ersten Aufruf einmal hart neu
laden (Strg+Shift+R). Da `base: './'` gesetzt ist, funktioniert die App sowohl
unter diesem Unterpfad als auch am Server-Root.

## Geteilte Liste (Supabase) – optional

Standardmäßig speichert Listly alles **lokal** (localStorage). Damit sich mehrere
Personen/Geräte **dieselbe Liste in Echtzeit** teilen, kann eine kostenlose
[Supabase](https://supabase.com)-Datenbank angebunden werden. Nur die aktuelle
**Liste** wird geteilt; Favoriten, Kaufverlauf und Kundenkarten bleiben pro
Gerät lokal.

**Einrichtung (einmalig, ~10 Min):**

1. Auf [supabase.com](https://supabase.com) kostenlos ein Projekt anlegen.
2. Im Dashboard: **SQL Editor → New query**, den Inhalt von
   [`supabase/schema.sql`](supabase/schema.sql) einfügen und **Run** klicken.
   (Legt die Tabelle an, aktiviert die Zugriffsregeln und Realtime.)
3. Unter **Project Settings → API** die **Project URL** und den **anon public**
   Key kopieren.
4. In [`src/lib/supabaseConfig.js`](src/lib/supabaseConfig.js) eintragen
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), optional `LIST_ID` anpassen.
5. Committen und pushen – der Deploy-Workflow baut und veröffentlicht automatisch.

Danach sehen alle Geräte, die die App öffnen, denselben Stand – Änderungen
erscheinen innerhalb ~1 Sekunde (die Synchronisation läuft ohne sichtbare
Anzeige im Hintergrund).

> ⚠️ **Datenschutz-Hinweis:** Beim gewählten Modell „offener geteilter Link“ (kein
> Login) sind `SUPABASE_URL`, der anon-Key und die `LIST_ID` in der öffentlich
> ausgelieferten App enthalten. Wer diese kennt, kann die Liste theoretisch lesen
> und ändern. Für eine Einkaufsliste ist das meist unkritisch – lege dort keine
> sensiblen Daten ab. Für echten Zugriffsschutz wäre eine Login-Variante nötig.

## Icons anpassen

Die PWA-Icons unter [`public/icons/`](public/icons) sind Platzhalter
(„L“-Monogramm im Marken-Grün). Zum Ersetzen einfach die Dateien austauschen:

- `pwa-192.png`, `pwa-512.png` – Standard-Icons
- `pwa-maskable-512.png` – maskierbares Icon (mit Sicherheitsrand)
- `apple-touch-icon.png`, `icon.svg` – iOS / Favicon

## Produktliste erweitern

In [`src/data/products.json`](src/data/products.json) einen Eintrag ergänzen:

```json
{ "name": "Sojaschnetzel", "category": "proteine", "emoji": "🌱" }
```

`category` referenziert eine `id` aus dem `categories`-Array, `emoji` ist
optional – ohne wird automatisch das Emoji der Kategorie genutzt (Auflösung in
[`src/lib/icons.js`](src/lib/icons.js)).

## Projektstruktur

```
src/
├── App.jsx                 # Orchestrierung: State, Header, Liste, FAB, Dialoge
├── main.jsx                # Einstieg, ErrorBoundary, localStorage-Migrationen
├── components/
│   ├── AddItemSheet.jsx    #   Hinzufügen-Sheet: Suche + Chips + Detailfelder
│   ├── FrequentChips.jsx   #   Schnellauswahl häufig gekaufter Artikel
│   ├── ShoppingList.jsx    #   Liste, nach Kategorie gruppiert, Fortschritt
│   ├── ListItem.jsx        #   Einzelzeile: Umschalt-Button + Swipe-Aktionen
│   ├── ItemEditInline.jsx  #   Inline-Bearbeitung in der aufgeklappten Kachel
│   ├── ProductIcon.jsx     #   Emoji-Symbol eines Artikels
│   ├── SyncStatus.jsx      #   Live/Verbinde/Offline-Anzeige
│   ├── Toast.jsx           #   Snackbars + aria-live-Regionen
│   ├── CheckoutDialog.jsx  #   „Einkauf abschließen“-Bottom-Sheet
│   ├── CardsSheet.jsx      #   Kundenkarten-Overlay (lazy geladen)
│   └── CodeImage.jsx       #   QR-/Barcode-Rendering (qrcode / jsbarcode)
├── hooks/
│   ├── useLocalStorage.js  #   State ↔ localStorage
│   ├── useShoppingItems.js #   Liste: geteilt (Supabase) oder lokal
│   ├── useToast.jsx        #   zentrale Statusmeldungen + Undo
│   ├── useDialogFocus.js   #   Fokusfalle/Escape/Fokusrückgabe für Dialoge
│   ├── useSwipeReveal.js   #   Wisch-Geste „Aktionen aufdecken“
│   └── useTheme.js         #   automatischer Dark Mode (prefers-color-scheme)
├── lib/                    # reine Helfer (Storage, Sync, Suche, Migrationen …)
├── data/products.json      # Vegane Kategorien & Produkte (Emoji je Produkt)
├── styles/
│   ├── tokens.css          #   Design-Tokens (Light/Dark)
│   └── index.css           #   Base + Komponenten-Styles
└── assets/fonts/           # Lokal gehostete Fonts (woff2)
```

Details zu Architektur, Datenfluss und Betrieb: siehe [`handover.md`](handover.md).

## Tech-Stack

- [Vite 5](https://vitejs.dev) + [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react)
- [React 18](https://react.dev)
- [@supabase/supabase-js](https://supabase.com/docs/reference/javascript) – Echtzeit-Sync (lazy geladen)
- [lucide-react](https://lucide.dev) (UI-Icons)
- [qrcode](https://github.com/soldair/node-qrcode) + [jsbarcode](https://github.com/lindell/JsBarcode) – Kundenkarten-Codes (lazy geladen)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (Manifest + Service Worker)
- [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) (Tests), [ESLint](https://eslint.org) (Linting)

> Hinweis: `npm audit` meldet ggf. eine Dev-Server-Warnung zu esbuild (transitiv
> über Vite 5). Sie betrifft ausschließlich den lokalen Entwicklungsserver, nicht
> das ausgelieferte PWA-Bundle.
