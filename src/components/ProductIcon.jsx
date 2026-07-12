import { memo } from 'react';
import { getItemEmoji } from '../lib/icons';

/** Rendert das Emoji-Symbol eines Artikels (Produkt → Kategorie → Standard). */
function ProductIcon({ name, category, className }) {
  return (
    <span className={className} role="img" aria-hidden="true">
      {getItemEmoji(name, category)}
    </span>
  );
}

export default memo(ProductIcon);
