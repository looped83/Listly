import { memo } from 'react';
import { LayoutGrid, List } from 'lucide-react';

// Datengetrieben statt zweier fast identischer Buttons (DRY) – neue Ansichten
// ließen sich hier einfach ergänzen.
const VIEWS = [
  { value: 'list', label: 'Listenansicht', Icon: List },
  { value: 'grid', label: 'Kachelansicht', Icon: LayoutGrid },
];

/**
 * Kleiner, dezenter Umschalter zwischen Listen- und Kachelansicht im Header.
 * Rein präsentational (kontrolliert über `view`/`onChange`) – die eigentliche
 * Ansichtslogik (State, Persistenz) bleibt in `App.jsx`.
 */
function ViewToggle({ view, onChange }) {
  return (
    <div className="view-toggle" role="group" aria-label="Ansicht der Einkaufsliste">
      {VIEWS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className="view-toggle__button"
          data-active={view === value}
          aria-pressed={view === value}
          aria-label={`Zur ${label} wechseln`}
          title={label}
          onClick={() => onChange(value)}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export default memo(ViewToggle);
