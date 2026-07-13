import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Pencil, Star, X } from 'lucide-react';
import ProductIcon from './ProductIcon';
import ItemEditInline from './ItemEditInline';
import { formatQuantity, itemLabel, readItemExtras } from '../lib/itemFields';

const REVEAL_WIDTH = 156; // px, Breite der aufgedeckten Aktionsleiste (3 Buttons)
const OPEN_THRESHOLD = 56; // px, ab hier rastet die Aktionsleiste beim Loslassen ein

/**
 * Eine Zeile der Einkaufsliste.
 *
 * Wischen von rechts nach links deckt drei Aktionen auf: Favorit, Bearbeiten,
 * Löschen. Für die Bedienung ohne Geste (Tastatur/Screenreader) sind dieselben
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
  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const horizontal = useRef(false);
  const dxRef = useRef(0); // aktueller Ausschlag – unabhängig vom Render-Timing
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [revealed, setRevealed] = useState(false); // Aktionsleiste aufgedeckt
  const rowRef = useRef(null);
  const actionsRef = useRef(null);

  const closeReveal = useCallback(() => {
    setRevealed(false);
    dxRef.current = 0;
    setDx(0);
  }, []);

  const openReveal = useCallback(() => {
    setRevealed(true);
    dxRef.current = -REVEAL_WIDTH;
    setDx(-REVEAL_WIDTH);
  }, []);

  // Klick außerhalb schließt die aufgedeckte Aktionsleiste wieder.
  useEffect(() => {
    if (!revealed) return undefined;
    const onPointerDown = (e) => {
      if (!rowRef.current?.contains(e.target) && !actionsRef.current?.contains(e.target)) {
        setAnimating(true);
        closeReveal();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [revealed, closeReveal]);

  const applyDx = useCallback((value) => {
    dxRef.current = value;
    setDx(value);
  }, []);

  const onTouchStart = useCallback(
    (e) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      dragging.current = true;
      horizontal.current = false;
      setAnimating(false);
      // Beim erneuten Anfassen vom aktuellen (ggf. aufgedeckten) Offset ausgehen.
      dxRef.current = revealed ? -REVEAL_WIDTH : 0;
    },
    [revealed],
  );

  const onTouchMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      const t = e.touches[0];
      const dX = t.clientX - start.current.x;
      const dY = t.clientY - start.current.y;
      // Richtung einmal festlegen: vertikal → Scrollen zulassen, nicht wischen.
      if (!horizontal.current && Math.abs(dX) < Math.abs(dY)) {
        dragging.current = false;
        return;
      }
      horizontal.current = true;
      const base = revealed ? -REVEAL_WIDTH : 0;
      const next = Math.min(0, Math.max(base + dX, -REVEAL_WIDTH));
      applyDx(next);
    },
    [applyDx, revealed],
  );

  const onTouchEnd = useCallback(() => {
    if (!dragging.current && !horizontal.current) return;
    dragging.current = false;
    horizontal.current = false;
    setAnimating(true);
    // Weit genug aufgedeckt → einrasten, sonst zurückgleiten.
    if (dxRef.current <= -OPEN_THRESHOLD) {
      openReveal();
    } else {
      closeReveal();
    }
  }, [openReveal, closeReveal]);

  const { quantity, unit, note } = readItemExtras(item);
  const qtyLabel = formatQuantity(quantity, unit);
  // Sprechende Bezeichnung inkl. Menge (+ Notiz) für die Aktions-Labels.
  const descriptor = itemLabel(item);
  const noteSuffix = note ? `, Notiz: ${note}` : '';

  // Nach einer Aktion (per Geste ausgelöst) die Leiste wieder einklappen.
  const afterGesture = useCallback(() => {
    setAnimating(true);
    closeReveal();
  }, [closeReveal]);

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
      {/*
        Aufgedeckte Aktionsleiste hinter der Kachel. Sie bleibt fokussierbar
        (kein aria-hidden), damit Favorit/Bearbeiten/Löschen auch ohne
        Wisch-Geste per Tastatur erreichbar sind – erhält ein Button den Fokus,
        klappt die Leiste automatisch auf; verlässt der Fokus sie, schließt sie.
      */}
      <div
        className="swipe__actions"
        ref={actionsRef}
        onFocus={() => {
          setAnimating(true);
          openReveal();
        }}
        onBlur={(e) => {
          if (!actionsRef.current?.contains(e.relatedTarget)) {
            setAnimating(true);
            closeReveal();
          }
        }}
      >
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
          <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={() => {
            afterGesture();
            onEdit(item.id);
          }}
          aria-label={`${descriptor} bearbeiten`}
        >
          <Pencil size={17} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={() => {
            afterGesture();
            onRemove(item.id);
          }}
          aria-label={`${descriptor} entfernen`}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div
        className="list-item"
        ref={rowRef}
        data-checked={item.checked}
        data-animating={animating}
        data-revealed={revealed}
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
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
              ? `${descriptor}${noteSuffix} als offen markieren`
              : `${descriptor}${noteSuffix} als erledigt markieren`
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
            {note && <span className="list-item__note">{note}</span>}
          </span>
        </button>
      </div>
    </li>
  );
}

export default memo(ListItem);
