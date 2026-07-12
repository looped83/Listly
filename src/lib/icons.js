import products from '../data/products.json';

// Produkt- und Kategorie-Symbole sind Emoji (in products.json gepflegt) – das
// bietet deutlich mehr Vielfalt als ein monochromer Icon-Satz und kostet nichts
// im Bundle. UI-Symbole (Häkchen, Stern, …) bleiben lucide-Icons.

export const DEFAULT_EMOJI = '🛒';

const normalize = (name) => name.trim().toLowerCase();

const categoryById = new Map(products.categories.map((c) => [c.id, c]));
const categoryOrder = new Map(products.categories.map((c, i) => [c.id, i]));
const productByName = new Map(products.products.map((p) => [normalize(p.name), p]));

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
  const product = productByName.get(normalize(name));
  if (product?.emoji) return product.emoji;

  const categoryId = category ?? product?.category;
  const cat = categoryId ? categoryById.get(categoryId) : null;
  if (cat?.emoji) return cat.emoji;

  return DEFAULT_EMOJI;
}

/** Bekannte Kategorie eines Artikels aus der Basisliste (oder null). */
export function getKnownCategory(name) {
  return productByName.get(normalize(name))?.category ?? null;
}
