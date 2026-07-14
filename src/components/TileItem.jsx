import { memo, useEffect, useId, useRef, useState } from 'react';
import { Pencil, Star, X } from 'lucide-react';
import ProductIcon from './ProductIcon';
import ItemEditInline from './ItemEditInline';
import { formatQuantityBadge, itemLabel, readItemExtras } from '../lib/itemFields';

/**
 * Eine Karte der Kachelansicht – dieselben Daten, Handler und Sub-Komponenten
 * wie `ListItem`, nur als kompakte Card statt als Zeile angeordnet. Keine
 * eigene Geschäftslogik: Umschalten/Favorisieren/Bearbeiten/Löschen rufen
 * exakt dieselben Callbacks wie in der Listenansicht auf.
 *
 * Favorit/Bearbeiten/Löschen liegen NICHT dauerhaft sichtbar in der Karte
 * (dafür ist eine Kachel zu klein) und auch nicht hinter einer Wisch-Geste
 * (passt nicht in ein zweidimensionales Grid). Stattdessen ersetzt ein langer
 * Druck den Karteninhalt durch die drei zentrierten Aktionen. Das native
 * `contextmenu`-Ereignis deckt dafür gleichzeitig Touch (langer Druck),
 * Maus (Rechtsklick) UND Tastatur (Kontextmenü-/Shift+F10-Taste) ab – ohne
 * eigene Gesten-Zeiterfassung.
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
  const [revealed, setRevealed] = useState(false);
  const liRef = useRef(null);
  const firstActionRef = useRef(null);
  const hintId = useId();

  const { quantity } = readItemExtras(item);
  const qtyLabel = formatQuantityBadge(quantity);
  const descriptor = itemLabel(item);

  const openActions = (e) => {
    e.preventDefault(); // natives Kontextmenü unterdrücken
    setRevealed(true);
  };
  const closeActions = () => setRevealed(false);

  // Aufgeklappt: Fokus auf die erste Aktion (wichtig, wenn per Tastatur
  // geöffnet), Klick außerhalb oder Escape schließt wieder.
  useEffect(() => {
    if (!revealed) return undefined;
    firstActionRef.current?.focus();
    const onPointerDown = (e) => {
      if (!liRef.current?.contains(e.target)) closeActions();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeActions();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [revealed]);

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
    <li className="tile" data-checked={item.checked} ref={liRef} onContextMenu={openActions}>
      {revealed ? (
        <div className="tile__actions" role="group" aria-label={`Aktionen für ${descriptor}`}>
          <p className="tile__actions-label">{item.name}</p>
          <div className="tile__actions-row">
            <button
              type="button"
              ref={firstActionRef}
              className="icon-button icon-button--fav"
              data-active={isFavorite}
              onClick={() => onToggleFavorite(item.name)}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite
                  ? `${item.name} aus Favoriten entfernen`
                  : `${item.name} zu Favoriten hinzufügen`
              }
            >
              <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="icon-button"
              onClick={() => {
                closeActions();
                onEdit(item.id);
              }}
              aria-label={`${descriptor} bearbeiten`}
            >
              <Pencil size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="icon-button icon-button--danger"
              onClick={() => {
                closeActions();
                onRemove(item.id);
              }}
              aria-label={`${descriptor} entfernen`}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="tile__toggle"
            onClick={() => onToggle(item.id)}
            aria-pressed={item.checked}
            aria-describedby={hintId}
            aria-label={
              item.checked
                ? `${descriptor} als offen markieren`
                : `${descriptor} als erledigt markieren`
            }
          >
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
          <span id={hintId} className="visually-hidden">
            Lange drücken oder Kontextmenü-Taste für Favorit, Bearbeiten und Löschen
          </span>
        </>
      )}
    </li>
  );
}

export default memo(TileItem);
