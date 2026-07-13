import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, MoreHorizontal, Pencil, Star, Trash2, X } from 'lucide-react';
import ProductIcon from './ProductIcon';
import ItemEditInline from './ItemEditInline';
import { formatQuantity, itemLabel, readItemExtras } from '../lib/itemFields';

const REVEAL_WIDTH = 156; // px, Breite der aufgedeckten Aktionsleiste (3 Buttons)
const OPEN_THRESHOLD = 56; // px, ab hier rastet die Aktionsleiste beim Loslassen ein

/**
 * Eine Zeile der Einkaufsliste.
 *
 * Wischen von rechts nach links deckt drei Aktionen auf: Favorit, Bearbeiten,
 * Löschen. Dieselben Aktionen sind – als tastatur-/screenreader-taugliche
 * Alternative zur Geste – auch über das „Mehr“-Menü erreichbar.
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
  const [revealed, setRevealed] = useState(false); // Aktionsleiste per Swipe aufgedeckt

  // „Mehr“-Menü: zugängliche Alternative zur Wisch-Geste (Favorit/Bearbeiten/Löschen).
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const moreRef = useRef(null);
  const actionsRef = useRef(null);
  const rowRef = useRef(null);

  const closeReveal = useCallback(() => {
    setRevealed(false);
    dxRef.current = 0;
    setDx(0);
  }, []);

  // Klick außerhalb schließt Menü bzw. aufgedeckte Aktionsleiste.
  useEffect(() => {
    if (!menuOpen && !revealed) return undefined;
    const onPointerDown = (e) => {
      if (menuOpen && !actionsRef.current?.contains(e.target)) setMenuOpen(false);
      if (revealed && !rowRef.current?.contains(e.target)) {
        setAnimating(true);
        closeReveal();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen, revealed, closeReveal]);

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
      setRevealed(true);
      applyDx(-REVEAL_WIDTH);
    } else {
      closeReveal();
    }
  }, [applyDx, closeReveal]);

  const { quantity, unit, note } = readItemExtras(item);
  const qtyLabel = formatQuantity(quantity, unit);
  // Sprechende Bezeichnung inkl. Menge (+ Notiz) für die Aktions-Labels.
  const descriptor = itemLabel(item);
  const noteSuffix = note ? `, Notiz: ${note}` : '';

  const handleFavorite = useCallback(() => {
    onToggleFavorite(item.name);
  }, [onToggleFavorite, item.name]);

  const handleEdit = useCallback(() => {
    onEdit(item.id);
  }, [onEdit, item.id]);

  const handleRemove = useCallback(() => {
    onRemove(item.id);
  }, [onRemove, item.id]);

  // Die drei Sekundäraktionen – identisch in der aufgedeckten Wisch-Leiste und
  // im „Mehr“-Menü. `afterAction` schließt das Menü bzw. die Leiste anschließend.
  const renderActions = (afterAction) => (
    <>
      <button
        type="button"
        className="icon-button icon-button--fav"
        data-active={isFavorite}
        onClick={() => {
          handleFavorite();
          afterAction?.();
        }}
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
          afterAction?.();
          handleEdit();
        }}
        aria-label={`${descriptor} bearbeiten`}
      >
        <Pencil size={17} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="icon-button icon-button--danger"
        onClick={() => {
          afterAction?.();
          handleRemove();
        }}
        aria-label={`${descriptor} entfernen`}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </>
  );

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
      {/* Aufgedeckte Aktionsleiste hinter der Kachel (Wisch-Geste). */}
      <div className="swipe__actions" aria-hidden={!revealed}>
        {renderActions(() => {
          setAnimating(true);
          closeReveal();
        })}
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
          schaltet den Erledigt-Status um, nicht nur der kleine Kreis. Favorit
          und Löschen sind eigene, gleichrangige Geschwister-Buttons – kein
          verschachteltes <button> in <button>.
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

        {/* Sekundäraktionen zusätzlich im zurückgenommenen „Mehr“-Menü, damit sie
            auch ohne Wisch-Geste (Tastatur/Screenreader) erreichbar bleiben. */}
        <div
          className="list-item__actions"
          ref={actionsRef}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && menuOpen) {
              e.stopPropagation();
              setMenuOpen(false);
              moreRef.current?.focus();
            }
          }}
        >
          <button
            type="button"
            ref={moreRef}
            className="icon-button list-item__more"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={`Weitere Aktionen für ${item.name}`}
          >
            <MoreHorizontal size={20} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="list-item__menu" id={menuId} role="group" aria-label={`Aktionen für ${item.name}`}>
              {renderActions(() => setMenuOpen(false))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default memo(ListItem);
