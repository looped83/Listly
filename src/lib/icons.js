import products from '../data/products.json';

// Produkt- und Kategorie-Symbole sind Emoji (in products.json gepflegt) – das
// bietet deutlich mehr Vielfalt als ein monochromer Icon-Satz und kostet nichts
// im Bundle. UI-Symbole (Häkchen, Stern, …) bleiben lucide-Icons.

export const DEFAULT_EMOJI = '🛒';

const normalize = (name) => name.trim().toLowerCase();

const categoryById = new Map(products.categories.map((c) => [c.id, c]));
const productByName = new Map(products.products.map((p) => [normalize(p.name), p]));

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
