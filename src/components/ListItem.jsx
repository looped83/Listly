import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, MoreHorizontal, Pencil, Star, Trash2, X } from 'lucide-react';
import ProductIcon from './ProductIcon';
import { formatQuantity, itemLabel, readItemExtras } from '../lib/itemFields';

const SWIPE_THRESHOLD = 80; // px, ab hier wird beim Loslassen gelöscht
const MAX_SWIPE = 120; // px, maximaler Ausschlag

/** Eine Zeile der Einkaufsliste. Per Swipe nach links löschbar. */
function ListItem({ item, isFavorite, mode = 'plan', onToggle, onToggleFavorite, onRemove, onEdit }) {
  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const horizontal = useRef(false);
  const dxRef = useRef(0); // aktueller Ausschlag – unabhängig vom Render-Timing
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [removing, setRemoving] = useState(false);

  // „Mehr"-Menü (nur Einkaufsmodus): fasst Favorit/Bearbeiten/Löschen zusammen,
  // damit der große Umschalt-Button die dominante Trefferfläche bleibt.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const moreRef = useRef(null);
  const actionsRef = useRef(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Klick außerhalb schließt das Menü (nur wenn offen).
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => {
      if (!actionsRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const applyDx = useCallback((value) => {
    dxRef.current = value;
    setDx(value);
  }, []);

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    dragging.current = true;
    horizontal.current = false;
    setAnimating(false);
  }, []);

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
      applyDx(dX < 0 ? Math.max(dX, -MAX_SWIPE) : 0);
    },
    [applyDx],
  );

  const onTouchEnd = useCallback(() => {
    if (!dragging.current && !horizontal.current) return;
    dragging.current = false;
    setAnimating(true);
    if (dxRef.current <= -SWIPE_THRESHOLD) {
      setRemoving(true);
      setTimeout(() => onRemove(item.id), 200);
    } else {
      applyDx(0);
    }
  }, [applyDx, item.id, onRemove]);

  const { quantity, unit, note } = readItemExtras(item);
  const qtyLabel = formatQuantity(quantity, unit);
  // Sprechende Bezeichnung inkl. Menge (+ Notiz) für die Aktions-Labels.
  const descriptor = itemLabel(item);
  const noteSuffix = note ? `, Notiz: ${note}` : '';

  // Die drei Sekundäraktionen – identisch in Plan-Leiste und Shop-Menü. Im Menü
  // schließt jede Aktion es zusätzlich (afterAction).
  const renderActions = (afterAction) => (
    <>
      <button
        type="button"
        className="icon-button icon-button--fav"
        data-active={isFavorite}
        onClick={() => {
          onToggleFavorite(item.name);
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
          onEdit(item.id);
          afterAction?.();
        }}
        aria-label={`${descriptor} bearbeiten`}
      >
        <Pencil size={17} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="icon-button icon-button--danger"
        onClick={() => {
          onRemove(item.id);
          afterAction?.();
        }}
        aria-label={`${descriptor} entfernen`}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </>
  );

  return (
    <li className="swipe" data-removing={removing}>
      <span className="swipe__hint" aria-hidden="true">
        <Trash2 size={18} />
      </span>
      <div
        className="list-item"
        data-checked={item.checked}
        data-animating={animating || removing}
        style={{ transform: removing ? undefined : `translateX(${dx}px)` }}
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

        {mode === 'shop' ? (
          // Einkaufsmodus: Sekundäraktionen in ein zurückgenommenes „Mehr"-Menü.
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
        ) : (
          // Planungsmodus: Favorit + Bearbeiten + Löschen direkt als Trefferflächen.
          <div className="list-item__actions">{renderActions()}</div>
        )}
      </div>
    </li>
  );
}

export default memo(ListItem);
