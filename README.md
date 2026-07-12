# Listly

Eine schlanke, **vegane Einkaufslisten-PWA** – gebaut mit **Vite + React**, ohne
unnötige Abhängigkeiten. Läuft lokal im Browser und lässt sich als App aufs Handy
installieren (offline-fähig).

## Features

- **Artikel verwalten** – hinzufügen, abhaken, entfernen, favorisieren.
- **Kaufverlauf** – abgehakte und „verbuchte“ Artikel merken sich ihre
  Kaufhäufigkeit. Häufig gekaufte Artikel erscheinen als Schnellauswahl-Chips.
  Der Verlauf bleibt dauerhaft erhalten – auch nachdem ein Artikel aus der
  aktuellen Liste gelöscht wurde und über App-Neustarts hinweg.
- **Autovervollständigung** – Vorschläge beim Tippen, priorisiert nach
  **Kaufverlauf → Favoriten → veganer Basisliste**, jeweils mit passendem Icon.
- **Vegane Produktdaten** – Kategorien und Produkte (Hafermilch, Tofu,
  Hefeflocken, veganer Käse …) liegen in [`src/data/products.json`](src/data/products.json)
  und sind leicht erweiterbar.
- **Passende Icons** – jedes Produkt / jede Kategorie bekommt ein
  [lucide-react](https://lucide.dev)-Icon, mit Fallback für unbekannte Artikel.
- **Light & Dark Mode** – vollständiges zweites Farbschema über CSS-Tokens
  (keine hartcodierten Farben in den Komponenten). Erkennt automatisch die
  Systemeinstellung (`prefers-color-scheme`), zusätzlich manueller Umschalter
  im Header (Hell → Dunkel → System); die Auswahl wird gespeichert.
- **PWA** – installierbar, Standalone-Modus, Offline-Support via Service Worker.
- **Lokale Fonts** – Fraunces, Inter & IBM Plex Mono sind selbst gehostet
  (kein CDN), für schnelle Ladezeiten und Offline-Fähigkeit.

## Datenmodell (localStorage)

Alle Daten liegen lokal im Browser unter folgenden Schlüsseln:

| Schlüssel          | Inhalt                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| `listly.items`     | Aktuelle Liste: `[{ id, name, category, checked }]`                        |
| `listly.favorites` | Favoriten: `["Hafermilch", …]`                                            |
| `listly.history`   | Kaufverlauf: `{ [name]: { name, category, count, lastPurchased } }`        |
| `listly.theme`     | Farbschema: `"light" \| "dark" \| "system"`                               |

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

## Build & Vorschau

```bash
npm run build    # Produktions-Build nach dist/
npm run preview  # gebautes Bundle lokal servieren
```

## Als PWA aufs Handy installieren

1. `npm run build && npm run preview` ausführen (oder `dist/` auf einen Webserver
   mit **HTTPS** deployen – für PWA-Installation außerhalb von `localhost`
   erforderlich).
2. Die Seite im mobilen Browser öffnen.
3. Über das Browser-Menü **„Zum Startbildschirm hinzufügen“ / „App installieren“**
   wählen. Listly startet danach im Standalone-Modus.

## Deployment auf GitHub Pages

Der Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) baut
die App bei jedem Push automatisch und veröffentlicht den fertigen `dist/`-Ordner
im Branch `gh-pages`. **Wichtig:** GitHub Pages darf **nicht** die Quelldateien
ausliefern, sondern muss den gebauten Branch nutzen.

Einmalige Einstellung in **Settings → Pages → „Build and deployment“**:

- **Source:** „Deploy from a branch“
- **Branch:** `gh-pages` / `/ (root)`

Danach ist die App unter `https://<user>.github.io/<repo>/` erreichbar
(z. B. `https://looped83.github.io/Listly/`). Beim ersten Aufruf einmal hart neu
laden (Strg+Shift+R). Da `base: './'` gesetzt ist, funktioniert die App sowohl
unter diesem Unterpfad als auch am Server-Root.

## Geteilte Liste (Supabase) – optional

Standardmäßig speichert Listly alles **lokal** (localStorage). Damit sich mehrere
Personen/Geräte **dieselbe Liste in Echtzeit** teilen, kann eine kostenlose
[Supabase](https://supabase.com)-Datenbank angebunden werden. Nur die aktuelle
**Liste** wird geteilt; Favoriten und Kaufverlauf bleiben pro Gerät lokal.

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

Danach zeigt der Header **„Live“** statt „Lokal“, und alle Geräte, die die App
öffnen, sehen denselben Stand (Änderungen erscheinen innerhalb ~1 Sekunde).

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
{ "name": "Sojaschnetzel", "category": "proteine", "icon": "Bean" }
```

`category` referenziert eine `id` aus dem `categories`-Array, `icon` (optional)
den Namen eines lucide-react-Icons (siehe [`src/lib/icons.js`](src/lib/icons.js)).
Ohne `icon` wird automatisch das Kategorie-Icon bzw. der Fallback genutzt.

## Projektstruktur

```
src/
├── App.jsx                 # State-Orchestrierung (items, favorites, history, theme)
├── main.jsx                # Einstiegspunkt
├── components/             # UI-Komponenten (memoisiert)
│   ├── AddItemForm.jsx     #   Eingabe + Autovervollständigung
│   ├── FrequentChips.jsx   #   Schnellauswahl häufig gekaufter Artikel
│   ├── ShoppingList.jsx    #   Liste (offen / erledigt)
│   ├── ListItem.jsx        #   Einzelzeile
│   ├── SyncStatus.jsx      #   Anzeige Live/Lokal-Sync
│   └── ThemeToggle.jsx     #   Farbschema-Umschalter
├── hooks/
│   ├── useLocalStorage.js  #   State ↔ localStorage
│   ├── useShoppingItems.js #   Liste: geteilt (Supabase) oder lokal
│   └── useTheme.js         #   Farbschema + prefers-color-scheme
├── lib/
│   ├── storage.js          #   localStorage-Zugriff (Keys, read/write)
│   ├── supabase.js         #   Supabase-Client (nur bei Konfiguration aktiv)
│   ├── supabaseConfig.js   #   ← hier Zugangsdaten eintragen
│   ├── history.js          #   Kaufverlauf (Häufigkeit verbuchen)
│   ├── suggestions.js      #   Autocomplete- & Chip-Logik
│   └── icons.js            #   Icon-Auflösung Produkt → Kategorie → Fallback
├── data/products.json      # Vegane Kategorien & Produkte
├── styles/
│   ├── tokens.css          #   Design-Tokens (Light/Dark)
│   └── index.css           #   Base + Komponenten-Styles
└── assets/fonts/           # Lokal gehostete Fonts (woff2)
```

## Tech-Stack

- [Vite 5](https://vitejs.dev) + [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react)
- [React 18](https://react.dev)
- [lucide-react](https://lucide.dev) (Icons)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (Manifest + Service Worker)

> Hinweis: `npm audit` meldet ggf. eine Dev-Server-Warnung zu esbuild (transitiv
> über Vite 5). Sie betrifft ausschließlich den lokalen Entwicklungsserver, nicht
> das ausgelieferte PWA-Bundle.
