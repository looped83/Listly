import { memo, useCallback, useRef, useState } from 'react';
import { Check, Star, Trash2, X } from 'lucide-react';
import { getItemIcon } from '../lib/icons';

const SWIPE_THRESHOLD = 80; // px, ab hier wird beim Loslassen gelöscht
const MAX_SWIPE = 120; // px, maximaler Ausschlag

/** Eine Zeile der Einkaufsliste. Per Swipe nach links löschbar. */
function ListItem({ item, isFavorite, onToggle, onToggleFavorite, onRemove }) {
  const Icon = getItemIcon(item.name, item.category);

  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const horizontal = useRef(false);
  const dxRef = useRef(0); // aktueller Ausschlag – unabhängig vom Render-Timing
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [removing, setRemoving] = useState(false);

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
        <button
          type="button"
          className="list-item__check"
          data-checked={item.checked}
          onClick={() => onToggle(item.id)}
          aria-pressed={item.checked}
          aria-label={
            item.checked ? `${item.name} als offen markieren` : `${item.name} als erledigt markieren`
          }
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
      </div>
    </li>
  );
}

export default memo(ListItem);
