// ─────────────────────────────────────────────────────────────────────────────
//  Reine Text-Normalisierung + deterministische Trefferbewertung (Scoring).
// ─────────────────────────────────────────────────────────────────────────────
//  Bewusst ohne externe Such-/„KI"-Bibliothek: jede Regel ist klein, explizit
//  und nachvollziehbar. Alle Funktionen sind pure (keine Seiteneffekte), damit
//  sie isoliert testbar und identisch in Autovervollständigung, Chips usw.
//  einsetzbar sind.

/**
 * Kanonische Form eines Textes für den Vergleich. Ziel: unterschiedliche, aber
 * gemeinte-gleiche Schreibweisen kollabieren auf **eine** Form.
 *  1. Kleinschreibung.
 *  2. ß → ss.
 *  3. Diakritische Zeichen entfernen (Unicode NFD + Combining-Marks strippen):
 *     é→e, ñ→n, und die Umlaute ä→a, ö→o, ü→u.
 *  4. ASCII-Ersatzschreibweisen der Umlaute kollabieren: ae→a, oe→o, ue→u.
 *     Zusammen mit (3) gilt damit robust: „ä“ ≡ „a“ ≡ „ae“.
 *  5. Whitespace normalisieren.
 * Konsequenz: Anfrage und Kandidat werden identisch normalisiert – echte Treffer
 * bleiben also erhalten; der einzige Preis ist, dass echtes „ae/oe/ue“ (z. B.
 * „Müsli“/„Muesli“) ebenfalls zusammenfällt, was hier erwünscht ist.
 */
export function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Zerlegt einen (bereits normalisierten) Text in alphanumerische Tokens. */
export function tokenize(normalized) {
  return normalized.split(/[^a-z0-9]+/).filter(Boolean);
}

/** Kompaktform: alle Nicht-Alphanumerik entfernt (z. B. „hafer milch“→„hafermilch“). */
export function compactText(normalized) {
  return normalized.replace(/[^a-z0-9]+/g, '');
}

/**
 * Sehr konservativer deutscher Plural-Stemmer: entfernt genau ein abschließendes
 * „n“ oder „s“ bei ausreichend langen Tokens. Deckt die häufigsten regelmäßigen
 * Plurale ab (Karotten→Karotte, Zwiebeln→Zwiebel, Bohnen→Bohne, Chips→Chip),
 * ohne kurze Wörter (Reis, Käse) zu verstümmeln. Wird auf **beide** Seiten
 * angewandt, daher genügt Konsistenz – linguistische Perfektion ist nicht nötig.
 */
export function stemDe(token) {
  if (token.length > 4 && (token.endsWith('n') || token.endsWith('s'))) {
    return token.slice(0, -1);
  }
  return token;
}

// ── Explizite Synonymliste ───────────────────────────────────────────────────
// Klein und bewusst gepflegt (v. a. Englisch → Deutsch sowie Alternativ-
// schreibweisen). Aliasse und Ziele werden normalisiert; Ziele existieren im
// Katalog (sonst schlicht wirkungslos, nie schädlich).
const SYNONYM_SOURCE = {
  'oat milk': 'Hafermilch',
  oatmilk: 'Hafermilch',
  'soy milk': 'Sojamilch',
  soymilk: 'Sojamilch',
  'almond milk': 'Mandelmilch',
  'rice milk': 'Reismilch',
  chickpeas: 'Kichererbsen',
  chickpea: 'Kichererbsen',
  'peanut butter': 'Erdnussbutter',
  broccoli: 'Brokkoli',
  tomatoes: 'Tomaten',
  tomato: 'Tomaten',
  courgette: 'Zucchini',
  aubergine: 'Aubergine',
};

const SYNONYMS = new Map(
  Object.entries(SYNONYM_SOURCE).map(([alias, target]) => [
    normalizeText(alias),
    normalizeText(target),
  ]),
);

/**
 * Normalisierte Ziel-Namen, für die die (normalisierte) Anfrage ein Synonym ist.
 * Aktuell 0 oder 1 Treffer; als Set gehalten, falls später mehrdeutige Aliasse
 * ergänzt werden.
 */
export function synonymTargets(normalizedQuery) {
  const target = SYNONYMS.get(normalizedQuery);
  return target ? new Set([target]) : new Set();
}

// ── Trefferstufen (höher = besser). Bewusst als benannte Konstanten. ──────────
export const MATCH = {
  EXACT: 7,
  SYNONYM: 6,
  PREFIX: 5,
  TOKEN_PREFIX: 4,
  SUBSTRING: 3,
  STEM: 2,
  FUZZY: 1,
  NONE: 0,
};

/** Prüft, ob jedes Anfrage-Token Präfix eines eigenen (distinct) Namens-Tokens ist. */
function everyTokenIsPrefix(queryTokens, nameTokens) {
  if (queryTokens.length === 0) return false;
  const used = new Array(nameTokens.length).fill(false);
  for (const qt of queryTokens) {
    let found = false;
    for (let i = 0; i < nameTokens.length; i++) {
      if (!used[i] && nameTokens[i].startsWith(qt)) {
        used[i] = true;
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

/**
 * Deterministische Trefferstufe einer Anfrage gegen einen Kandidaten – ohne
 * Fuzzy (das gate-t der Aufrufer über die Eingabelänge). Priorität exakt der
 * Aufgabenvorgabe: exakt → Präfix → Token-Präfix → Teilstring → Singular/Plural.
 *
 * @param {string} qNorm  bereits normalisierte Anfrage
 * @param {{ norm: string, tokens: string[], compact: string }} cand
 */
export function matchTier(qNorm, cand) {
  if (!qNorm) return MATCH.NONE;
  const { norm, tokens, compact } = cand;

  if (norm === qNorm) return MATCH.EXACT;
  if (norm.startsWith(qNorm)) return MATCH.PREFIX;

  const qTokens = tokenize(qNorm);
  if (everyTokenIsPrefix(qTokens, tokens)) return MATCH.TOKEN_PREFIX;

  if (norm.includes(qNorm) || compact.includes(compactText(qNorm))) return MATCH.SUBSTRING;

  if (qTokens.length === 1) {
    const qs = stemDe(qTokens[0]);
    if (qs.length >= 3 && tokens.some((t) => stemDe(t) === qs)) return MATCH.STEM;
  }

  return MATCH.NONE;
}

/**
 * Minimale Editierdistanz zwischen `needle` und irgendeinem Teilstring von
 * `haystack` (approximatives Substring-Matching nach Sellers). So toleriert die
 * Suche Tippfehler, ohne dass die Eingabe das ganze Wort abdecken muss:
 * „schamp“ passt z. B. mit Distanz 1 auf „champignons“.
 */
export function substringEditDistance(needle, haystack) {
  const m = needle.length;
  const n = haystack.length;
  if (m === 0) return 0;
  // Erste Zeile 0 → der Treffer darf an beliebiger Position beginnen.
  let prev = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1);
    cur[0] = i; // needle-Zeichen streichen
    for (let j = 1; j <= n; j++) {
      const cost = needle[i - 1] === haystack[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return Math.min(...prev); // bestes Ende an beliebiger Position
}

// Fuzzy nur ab dieser (normalisierten) Eingabelänge – kurze Eingaben liefern
// über Präfix/Teilstring schon genug, unscharfe Suche erzeugt dort nur Rauschen.
export const FUZZY_MIN_LENGTH = 4;

/** Strenge Fehlertoleranz: 1 Editierschritt, ab langer Eingabe (≥ 8) höchstens 2. */
export function fuzzyThreshold(length) {
  return length >= 8 ? 2 : 1;
}

/** Vorberechnete Vergleichsform eines Namens (spart Wiederholung im Hot Path). */
export function describeText(name) {
  const norm = normalizeText(name);
  return { norm, tokens: tokenize(norm), compact: compactText(norm) };
}
