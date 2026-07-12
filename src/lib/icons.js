import {
  Apple,
  Banana,
  Bean,
  Carrot,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Droplet,
  Flame,
  Grape,
  IceCream,
  Leaf,
  Milk,
  Nut,
  Package,
  Salad,
  Sandwich,
  ShoppingBasket,
  Snowflake,
  Soup,
  Sparkles,
  SprayCan,
  Trash2,
  Wheat,
} from 'lucide-react';
import products from '../data/products.json';

// Registry aller im Datensatz referenzierten Icons. Bewusst statisch gehalten,
// damit lucide-react getreeshaked werden kann (kein dynamischer Import).
const ICON_REGISTRY = {
  Apple,
  Banana,
  Bean,
  Carrot,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Droplet,
  Flame,
  Grape,
  IceCream,
  Leaf,
  Milk,
  Nut,
  Package,
  Salad,
  Sandwich,
  Snowflake,
  Soup,
  Sparkles,
  SprayCan,
  Trash2,
  Wheat,
};

// Fallback-Icon für unbekannte Artikel ohne Zuordnung.
export const FallbackIcon = ShoppingBasket;

const normalize = (name) => name.trim().toLowerCase();

// Nachschlagetabellen einmalig aus der JSON aufbauen.
const categoryById = new Map(products.categories.map((c) => [c.id, c]));
const productByName = new Map(products.products.map((p) => [normalize(p.name), p]));

/** Icon-Komponente zu einem Registry-Namen (mit Fallback). */
export function iconByName(name) {
  return ICON_REGISTRY[name] || FallbackIcon;
}

/** Kategorie-Metadaten (inkl. Icon-Komponente) zu einer Kategorie-ID. */
export function getCategory(categoryId) {
  const category = categoryById.get(categoryId);
  if (!category) return null;
  return { ...category, Icon: iconByName(category.icon) };
}

/**
 * Löst das Icon für einen Artikel auf:
 * 1. produktspezifisches Icon, 2. Kategorie-Icon, 3. Fallback.
 * `category` kann optional mitgegeben werden (z. B. aus History/Favoriten).
 */
export function getItemIcon(name, category) {
  const product = productByName.get(normalize(name));
  const resolvedCategory = category ?? product?.category;

  if (product?.icon) return iconByName(product.icon);

  const cat = resolvedCategory ? categoryById.get(resolvedCategory) : null;
  if (cat?.icon) return iconByName(cat.icon);

  return FallbackIcon;
}

/** Bekannte Kategorie eines Artikels aus der Basisliste (oder null). */
export function getKnownCategory(name) {
  return productByName.get(normalize(name))?.category ?? null;
}
