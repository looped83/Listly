import { memo } from 'react';
import { Check, Star, X } from 'lucide-react';
import { getItemIcon } from '../lib/icons';

/** Eine Zeile der Einkaufsliste. */
function ListItem({ item, isFavorite, onToggle, onToggleFavorite, onRemove }) {
  const Icon = getItemIcon(item.name, item.category);

  return (
    <li className="list-item" data-checked={item.checked}>
      <button
        type="button"
        className="list-item__check"
        data-checked={item.checked}
        onClick={() => onToggle(item.id)}
        aria-pressed={item.checked}
        aria-label={item.checked ? `${item.name} als offen markieren` : `${item.name} als erledigt markieren`}
      >
        <Check size={16} strokeWidth={3} aria-hidden="true" />
      </button>

      <span className="list-item__icon">
        <Icon size={20} aria-hidden="true" />
      </span>

      <span className="list-item__name">{item.name}</span>

      <button
        type="button"
        className="icon-button icon-button--fav"
        data-active={isFavorite}
        onClick={() => onToggleFavorite(item.name)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `${item.name} aus Favoriten entfernen` : `${item.name} zu Favoriten`}
      >
        <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="icon-button icon-button--danger"
        onClick={() => onRemove(item.id)}
        aria-label={`${item.name} entfernen`}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </li>
  );
}

export default memo(ListItem);
