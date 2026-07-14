import { memo, useEffect, useId, useRef, useState } from 'react';
import { Pencil, Star, X } from 'lucide-react';
import ProductIcon from './ProductIcon';
import ItemEditInline from './ItemEditInline';
import { formatQuantityBadge, itemLabel, readItemExtras } from '../lib/itemFields';

// Dauer bis ein gehaltener Druck als „lang“ zählt, und wie viel Bewegung dabei
// toleriert wird (mehr → gilt als Scrollen/Wischen, kein langer Druck mehr).
const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Eine Karte der Kachelansicht – dieselben Daten, Handler und Sub-Komponenten
 * wie `ListItem`, nur als kompakte, quadratische Card statt als Zeile
 * angeordnet. Keine eigene Geschäftslogik: Umschalten/Favorisieren/
 * Bearbeiten/Löschen rufen exakt dieselben Callbacks wie in der
 * Listenansicht auf.
 *
 * Favorit/Bearbeiten/Löschen liegen NICHT dauerhaft sichtbar in der Karte
 * (dafür ist eine Kachel zu klein) und auch nicht hinter einer Wisch-Geste
 * (passt nicht in ein zweidimensionales Grid). Stattdessen ersetzt ein langer
 * Druck den Karteninhalt durch die drei zentrierten Aktionen – die Kachel
 * bleibt dabei exakt gleich groß (kein Layoutsprung) und färbt sich grün
 * (Akzentfarbe, wie die Aktionsleiste der Listenansicht); der Artikelname
 * tritt dabei zurück (Farbe + Position der Kachel identifizieren sie).
 *
 * Zwei Auslöser ergänzen sich: eine selbst erfasste Pointer-Haltedauer
 * (zuverlässig für Touch – das native `contextmenu`-Ereignis feuert auf
 * iOS Safari bei generischen Elementen wie einem Button nicht zuverlässig)
 * sowie das native `contextmenu`-Ereignis für Rechtsklick (Maus) und die
 * Kontextmenü-/Shift+F10-Taste (Tastatur).
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
  const actionsRef = useRef(null);
  const pressTimerRef = useRef(null);
  const pressStartRef = useRef({ x: 0, y: 0 });
  const hintId = useId();

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };
  const openActions = () => setRevealed(true);
  const closeActions = () => setRevealed(false);

  // Eigene Haltedauer-Erfassung (Touch UND Maus): startet einen Timer bei
  // Pointer-Druck, bricht bei zu viel Bewegung (Scroll/Wisch) oder beim
  // Loslassen vor Ablauf ab – dann bleibt es ein normaler Tap/Klick.
  const onPointerDown = (e) => {
    if (revealed) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return; // Rechtsklick → onContextMenu
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    clearPressTimer();
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      openActions();
    }, LONG_PRESS_MS);
  };
  const onPointerMove = (e) => {
    if (!pressTimerRef.current) return;
    const dx = e.clientX - pressStartRef.current.x;
    const dy = e.clientY - pressStartRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) clearPressTimer();
  };
  // Natives Kontextmenü (Rechtsklick/Tastatur) unterdrücken und ebenfalls öffnen.
  const onContextMenu = (e) => {
    e.preventDefault();
    openActions();
  };

  useEffect(() => clearPressTimer, []);

  // Aufgeklappt: Fokus auf das Panel selbst (nicht auf den Favorit-Button –
  // sonst zeigt der beim Öffnen per Touch/Maus einen unpassenden Fokusring).
  // Ein „echter“ Tab-Druck erreicht Favorit als Erstes ganz normal und zeigt
  // dann zurecht einen Ring. Klick außerhalb oder Escape schließt wieder.
  useEffect(() => {
    if (!revealed) return undefined;
    actionsRef.current?.focus();
    const onDocPointerDown = (e) => {
      if (!liRef.current?.contains(e.target)) closeActions();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeActions();
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
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

  // Erst ab hier gebraucht (die Editieren-Kachel oben zeigt weder Menge noch
  // Aktions-Label) – unnötige Arbeit während des Bearbeitens vermieden.
  const { quantity } = readItemExtras(item);
  const qtyLabel = formatQuantityBadge(quantity);
  const descriptor = itemLabel(item);

  return (
    <li
      className="tile"
      data-checked={item.checked}
      data-revealed={revealed}
      ref={liRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearPressTimer}
      onPointerCancel={clearPressTimer}
      onPointerLeave={clearPressTimer}
      onContextMenu={onContextMenu}
    >
      {revealed ? (
        <div
          className="tile__actions"
          role="group"
          aria-label={`Aktionen für ${descriptor}`}
          ref={actionsRef}
          tabIndex={-1}
        >
          <button
            type="button"
            className="icon-button icon-button--fav tile__actions-fav"
            data-active={isFavorite}
            onClick={() => onToggleFavorite(item.name)}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite
                ? `${item.name} aus Favoriten entfernen`
                : `${item.name} zu Favoriten hinzufügen`
            }
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>

          <div className="tile__actions-main">
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                closeActions();
                onEdit(item.id);
              }}
              aria-label={`${descriptor} bearbeiten`}
            >
              <Pencil size={16} aria-hidden="true" />
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
              <X size={16} aria-hidden="true" />
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
            {/* Der Name bleibt der visuelle Anker in der Kachelmitte, unabhängig
                davon, wie viel Platz Icon/Menge oben bzw. unten einnehmen. */}
            <span className="tile__name-slot">
              <span className="list-item__name">{item.name}</span>
            </span>
            {qtyLabel && (
              <span className="list-item__qty" aria-hidden="true">
                {qtyLabel}
              </span>
            )}
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
