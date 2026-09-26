import products from '../data/products.json';
import { normalizeName, normalizeText, stemDe, tokenize } from './textMatch';

// Produkt- und Kategorie-Symbole sind Emoji (in products.json gepflegt) – das
// bietet deutlich mehr Vielfalt als ein monochromer Icon-Satz und kostet nichts
// im Bundle. UI-Symbole (Häkchen, Stern, …) bleiben lucide-Icons.

export const DEFAULT_EMOJI = '🛒';

// Kategorie-Auswahl für den Bearbeiten-Dialog (id + Anzeigename, in Reihenfolge).
export const CATEGORY_OPTIONS = products.categories.map((c) => ({ id: c.id, name: c.name }));

const categoryById = new Map(products.categories.map((c) => [c.id, c]));
const categoryOrder = new Map(products.categories.map((c, i) => [c.id, i]));
const productByName = new Map(products.products.map((p) => [normalizeName(p.name), p]));

// Vergleichsschlüssel für den Katalog-Abgleich – dieselben Regeln wie die
// Suche (textMatch): Groß-/Kleinschreibung, Umlaute (ä ≡ a ≡ ae), Diakritika
// und je Wort der Singular. So findet „Bananen“ die „Banane“, „Äpfel“ den
// „Apfel“ und „Tomate“ die „Tomaten“.
const matchKey = (name) => tokenize(normalizeText(name)).map(stemDe).join(' ');

const productByKey = new Map();
for (const p of products.products) {
  const key = matchKey(p.name);
  if (!productByKey.has(key)) productByKey.set(key, p);
}
const productKeyTokens = products.products.map((p) => ({
  category: p.category,
  tokens: matchKey(p.name).split(' '),
}));

/** Katalogprodukt zu einem Namen: exakt, sonst über Schreibweise/Plural (oder null). */
function findProduct(name) {
  return productByName.get(normalizeName(name)) ?? productByKey.get(matchKey(name)) ?? null;
}

// Kürzere Grundwörter (z. B. „Öl“) stecken am Ende zu vieler Wörter.
const HEAD_NOUN_MIN_LENGTH = 3;

/**
 * Kategorie über das Grundwort deutscher Komposita: „Brot“ steckt am Wortende
 * von Vollkornbrot, Dinkelbrot … → Brot & Backwaren. Nur bei klarer Mehrheit
 * (≥ 2/3 der Treffer in einer Kategorie) – mehrdeutige Wörter wie „Butter“
 * (Vegane Butter vs. Erdnussbutter) bleiben bewusst ohne Kategorie.
 */
function categoryByHeadNoun(name) {
  const key = matchKey(name);
  if (key.length < HEAD_NOUN_MIN_LENGTH || key.includes(' ')) return null;
  if (!headNounCache.has(key)) headNounCache.set(key, majorityCategory(key));
  return headNounCache.get(key);
}

// Ergebnis je Wort merken: die Suche fragt z. B. für jeden Favoriten bei jedem
// Tastendruck nach – der Katalog muss dafür nur einmal durchlaufen werden.
const headNounCache = new Map();

function majorityCategory(key) {
  const counts = new Map();
  let hits = 0;
  for (const { category, tokens } of productKeyTokens) {
    if (!tokens.some((token) => token.endsWith(key))) continue;
    hits += 1;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  for (const [category, count] of counts) {
    if (count * 3 >= hits * 2) return category;
  }
  return null;
}

const OTHER_CATEGORY = { id: '__other', name: 'Sonstiges', emoji: '🛒', order: 999 };

/** Metadaten (Name, Emoji, Reihenfolge) einer Kategorie – Fallback „Sonstiges“. */
export function categoryInfo(categoryId) {
  const category = categoryId ? categoryById.get(categoryId) : null;
  if (!category) return OTHER_CATEGORY;
  return {
    id: category.id,
    name: category.name,
    emoji: category.emoji,
    order: categoryOrder.get(category.id),
  };
}

/**
 * Löst das Emoji für einen Artikel auf:
 * 1. produktspezifisches Emoji, 2. Kategorie-Emoji, 3. Standard.
 */
export function getItemEmoji(name, category) {
  const product = findProduct(name);
  if (product?.emoji) return product.emoji;

  const categoryId = category ?? product?.category ?? categoryByHeadNoun(name);
  const cat = categoryId ? categoryById.get(categoryId) : null;
  if (cat?.emoji) return cat.emoji;

  return DEFAULT_EMOJI;
}

/**
 * Bekannte Kategorie eines Artikels aus der Basisliste (oder null): exakter
 * Name, sonst Schreibweise/Plural, sonst eindeutiges Grundwort.
 */
export function getKnownCategory(name) {
  return findProduct(name)?.category ?? categoryByHeadNoun(name);
}
