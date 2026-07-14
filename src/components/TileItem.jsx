import { memo } from 'react';
import { Check, Pencil, Star, X } from 'lucide-react';
import ProductIcon from './ProductIcon';
import ItemEditInline from './ItemEditInline';
import { formatQuantityBadge, itemLabel, readItemExtras } from '../lib/itemFields';

/**
 * Eine Karte der Kachelansicht – dieselben Daten, Handler und Sub-Komponenten
 * wie `ListItem`, nur als Card statt als Zeile angeordnet. Keine eigene
 * Geschäftslogik: Umschalten/Favorisieren/Bearbeiten/Löschen rufen exakt
 * dieselben Callbacks wie in der Listenansicht auf.
 *
 * Anders als `ListItem` liegen Favorit/Bearbeiten/Löschen hier nicht hinter
 * einer Wisch-Geste, sondern als kleine, stets sichtbare Aktionsleiste unter
 * der Karte – eine horizontale Swipe-Geste passt nicht in ein zweidimensionales
 * Grid schmaler Karten. Alle Aktionen bleiben dadurch gleichwertig erreichbar.
 */
function TileItem({
  item,
  isFavorite,
  isEditing,
  onToggle,
  onToggleFavorite,
  onRemove,
  onEdit,
  onSave,
  onCancelEdit,
  findConflict,
}) {
  const { quantity } = readItemExtras(item);
  const qtyLabel = formatQuantityBadge(quantity);
  const descriptor = itemLabel(item);

  if (isEditing) {
    return (
      <li className="tile tile--editing">
        <div className="list-item list-item--editing">
          <ItemEditInline
            item={item}
            findConflict={findConflict}
            onSave={onSave}
            onCancel={onCancelEdit}
          />
        </div>
      </li>
    );
  }

  return (
    <li className="tile" data-checked={item.checked}>
      <button
        type="button"
        className="tile__toggle"
        onClick={() => onToggle(item.id)}
        aria-pressed={item.checked}
        aria-label={
          item.checked
            ? `${descriptor} als offen markieren`
            : `${descriptor} als erledigt markieren`
        }
      >
        <span className="list-item__check" data-checked={item.checked} aria-hidden="true">
          <Check size={16} strokeWidth={3} aria-hidden="true" />
        </span>
        <ProductIcon name={item.name} category={item.category} className="list-item__icon" />
        <span className="list-item__name">
          {qtyLabel && (
            <span className="list-item__qty" aria-hidden="true">
              {qtyLabel}
            </span>
          )}
          {item.name}
        </span>
      </button>

      <div className="tile__actions">
        <button
          type="button"
          className="icon-button icon-button--fav"
          data-active={isFavorite}
          onClick={() => onToggleFavorite(item.name)}
          aria-pressed={isFavorite}
          aria-label={
            isFavorite ? `${item.name} aus Favoriten entfernen` : `${item.name} zu Favoriten hinzufügen`
          }
        >
          <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={() => onEdit(item.id)}
          aria-label={`${descriptor} bearbeiten`}
        >
          <Pencil size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={() => onRemove(item.id)}
          aria-label={`${descriptor} entfernen`}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export default memo(TileItem);
