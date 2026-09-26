import { memo } from 'react';
import { Check } from 'lucide-react';
import ProductIcon from './ProductIcon';
import ItemEditInline from './ItemEditInline';
import { EditButton, FavoriteButton, RemoveButton } from './ItemActionButtons';
import { useSwipeReveal } from '../hooks/useSwipeReveal';
import { formatQuantityBadge, itemLabel, readItemExtras } from '../lib/itemFields';

const REVEAL_WIDTH = 156; // px, Breite der aufgedeckten Aktionsleiste (3 Buttons)
const OPEN_THRESHOLD = 56; // px, ab hier rastet die Aktionsleiste beim Loslassen ein
const DELETE_THRESHOLD_RATIO = 0.72; // Anteil der Zeilenbreite für „kompletten“ Wisch → Löschen

/**
 * Eine Zeile der Einkaufsliste.
 *
 * Wischen von rechts nach links deckt drei Aktionen auf: Favorit, Bearbeiten,
 * Löschen. Ein kompletter Wisch (weit über die Aktionsleiste hinaus) entfernt
 * den Artikel direkt – der freigelegte Hintergrund färbt sich dabei von Grün
 * nach Rot. Für die Bedienung ohne Geste (Tastatur/Screenreader) sind dieselben
 * Aktionen fokussierbar – erhält eine von ihnen den Fokus, klappt die Leiste
 * automatisch auf.
 *
 * „Bearbeiten“ klappt die Kachel direkt auf (kein Overlay) und zeigt die
 * Bearbeitungsfelder inline.
 */
function ListItem({
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
  const { rowProps, actionsProps, backdropProps, closeAfterAction } = useSwipeReveal({
    revealWidth: REVEAL_WIDTH,
    openThreshold: OPEN_THRESHOLD,
    deleteThresholdRatio: DELETE_THRESHOLD_RATIO,
    onDelete: () => onRemove(item.id),
  });

  const { quantity } = readItemExtras(item);
  // Sichtbares Badge zeigt immer die Menge (Standard „1 ×“).
  const qtyLabel = formatQuantityBadge(quantity);
  // Sprechende Bezeichnung inkl. Menge (ab 2) für die Aktions-Labels.
  const descriptor = itemLabel(item);

  // Aufgeklappte Kachel: Bearbeitungsfelder inline statt Overlay.
  if (isEditing) {
    return (
      <li className="swipe swipe--editing">
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
    <li className="swipe">
      {/* Hintergrund hinter Aktionsleiste/Zeile: Grün→Rot je nach
          Wisch-Fortschritt Richtung „kompletter Wisch löscht“ (aria-hidden,
          rein visuelles Feedback – die eigentliche Löschen-Aktion bleibt der
          fokussierbare Button in der Aktionsleiste). */}
      <div className="swipe__backdrop" aria-hidden="true" {...backdropProps} />
      {/*
        Aufgedeckte Aktionsleiste hinter der Kachel. Sie bleibt fokussierbar
        (kein aria-hidden), damit Favorit/Bearbeiten/Löschen auch ohne
        Wisch-Geste per Tastatur erreichbar sind – erhält ein Button den Fokus,
        klappt die Leiste automatisch auf; verlässt der Fokus sie, schließt sie.
      */}
      <div className="swipe__actions" {...actionsProps}>
        <FavoriteButton
          name={item.name}
          isFavorite={isFavorite}
          onToggle={onToggleFavorite}
          iconSize={18}
        />
        <EditButton
          descriptor={descriptor}
          iconSize={17}
          onClick={() => {
            closeAfterAction();
            onEdit(item.id);
          }}
        />
        <RemoveButton
          descriptor={descriptor}
          iconSize={18}
          onClick={() => {
            closeAfterAction();
            onRemove(item.id);
          }}
        />
      </div>

      <div className="list-item" data-checked={item.checked} {...rowProps}>
        {/*
          Hauptbereich (Kreis + Icon + Name) als EIN Button: die gesamte Fläche
          schaltet den Erledigt-Status um, nicht nur der kleine Kreis.
        */}
        <button
          type="button"
          className="list-item__toggle"
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
          <span className="list-item__text">
            <span className="list-item__name">
              {qtyLabel && (
                <span className="list-item__qty" aria-hidden="true">
                  {qtyLabel}
                </span>
              )}
              {item.name}
            </span>
          </span>
        </button>
      </div>
    </li>
  );
}

export default memo(ListItem);
