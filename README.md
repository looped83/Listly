# Listly

Eine schlanke, **vegane Einkaufslisten-PWA** – gebaut mit **Vite + React**, ohne
unnötige Abhängigkeiten. Läuft lokal im Browser und lässt sich als App aufs Handy
installieren (offline-fähig).

## Features

- **Artikel verwalten** – hinzufügen, abhaken, favorisieren; entfernen per
  ×-Button **oder Wischen nach links** (Swipe-to-delete).
- **Schnelleingabe** – beim manuellen Hinzufügen erkennt Listly konservativ eine
  führende Menge/Einheit und eine optionale Notiz (siehe unten). Im Zweifel bleibt
  die Eingabe unverändert der Artikelname; ausgewählte Vorschläge werden nie zerlegt.
- **Kaufverlauf** – abgehakte und „verbuchte“ Artikel merken sich ihre
  Kaufhäufigkeit. Häufig gekaufte Artikel erscheinen als horizontal scrollbare
  Schnellauswahl-Chips (einzeln über ihr ×-Symbol aus den Vorschlägen entfernbar).
  Der Verlauf bleibt dauerhaft erhalten – auch nachdem ein Artikel aus der
  aktuellen Liste gelöscht wurde und über App-Neustarts hinweg.
- **Autovervollständigung** – Vorschläge beim Tippen, priorisiert nach
  **Kaufverlauf → Favoriten → veganer Basisliste**, jeweils mit passendem Icon.
- **Vegane Produktdaten** – Kategorien und Produkte (Hafermilch, Tofu,
  Hefeflocken, veganer Käse …) liegen in [`src/data/products.json`](src/data/products.json)
  und sind leicht erweiterbar.
- **Passende Icons** – jedes Produkt / jede Kategorie bekommt ein
  [lucide-react](https://lucide.dev)-Icon, mit Fallback für unbekannte Artikel.
- **Automatischer Dark Mode** – vollständiges zweites Farbschema über CSS-Tokens
  (keine hartcodierten Farben in den Komponenten). Folgt automatisch der
  Systemeinstellung (`prefers-color-scheme`), ohne manuellen Umschalter.
- **PWA** – installierbar, Standalone-Modus, Offline-Support via Service Worker.
- **Lokale Fonts** – Fraunces, Inter & IBM Plex Mono sind selbst gehostet
  (kein CDN), für schnelle Ladezeiten und Offline-Fähigkeit.

## Schnelleingabe (Menge / Einheit / Notiz)

Beim **manuellen** Absenden im Eingabefeld erkennt Listly konservativ ein
eindeutiges Präfix für Menge/Einheit sowie eine mit `#` eingeleitete Notiz. Die
Zerlegung passiert **nur bei frei getipptem Text** – wählst du einen Vorschlag
aus, wird er unverändert übernommen.

| Eingabe               | Menge | Einheit | Name       | Notiz        |
| --------------------- | ----- | ------- | ---------- | ------------ |
| `2x Hafermilch`       | 2     | –       | Hafermilch | –            |
| `2 × Hafermilch`      | 2     | –       | Hafermilch | –            |
| `500 g Tofu`          | 500   | g       | Tofu       | –            |
| `1,5 l Wasser`        | 1,5   | l       | Wasser     | –            |
| `3 Bananen #reif`     | 3     | –       | Bananen    | reif         |
| `Tofu #geräuchert`    | –     | –       | Tofu       | geräuchert   |

**Regeln (bewusst konservativ):**

- **Reihenfolge:** `#` trennt zuerst die Notiz ab; davor wird ein Mengen-Präfix
  gesucht. Greift kein Muster, ist die komplette Eingabe der Name.
- **Muster:** Multiplikator (`2x`, `2 ×`), Menge + bekannte Einheit (`500 g`),
  oder reine **Ganzzahl** als Anzahl (`3 Bananen`).
- **Dezimaltrenner:** Komma **und** Punkt (`1,5` = `1.5`).
- **Erlaubte Einheiten** (werden normalisiert): `g` (`gr`, `gramm`), `kg` (`kilo`,
  `kilogramm`), `mg`, `l` (`ltr`, `liter`), `ml` (`milliliter`), `cl`, `dl`.
  Andere Wörter zählen nicht als Einheit.
- **Fehlinterpretationsschutz:** Produktnamen mit Zahlen bleiben unangetastet –
  z. B. `0% Joghurt`, `7Up`, `3-Minuten-Terrine` oder `2xHafermilch` (ohne
  Leerzeichen) werden **nicht** zerlegt.
- **Dublettenerkennung** läuft weiterhin über den reinen Namen – `2 × Hafermilch`
  gilt als „Hafermilch".

Die Logik steckt als reine Funktion in
[`src/lib/quickInput.js`](src/lib/quickInput.js) (`parseQuickInput`); die
Einheiten-Liste (`QUICK_UNIT_ALIASES`) ist dort leicht erweiterbar.

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

Der Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) baut,
**testet** und veröffentlicht die App bei jedem Push auf `main` automatisch über
die offizielle GitHub-Actions-Pages-Pipeline. Es wird ausschließlich der frisch
gebaute `dist/`-Ordner als Pages-Artefakt hochgeladen – es gibt keinen
`gh-pages`-Branch und kein committetes Build-Artefakt mehr. So entspricht der
veröffentlichte Stand reproduzierbar dem Quellcode auf `main`.

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
│   └── ListItem.jsx        #   Einzelzeile (Swipe-to-delete)
├── hooks/
│   ├── useLocalStorage.js  #   State ↔ localStorage
│   ├── useShoppingItems.js #   Liste: geteilt (Supabase) oder lokal
│   └── useTheme.js         #   automatischer Dark Mode (prefers-color-scheme)
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
