import { memo } from 'react';
import { LayoutGrid, List } from 'lucide-react';

/**
 * Kleiner, dezenter Umschalter zwischen Listen- und Kachelansicht im Header.
 * Rein präsentational (kontrolliert über `view`/`onChange`) – die eigentliche
 * Ansichtslogik (State, Persistenz) bleibt in `App.jsx`.
 */
function ViewToggle({ view, onChange }) {
  return (
    <div className="view-toggle" role="group" aria-label="Ansicht der Einkaufsliste">
      <button
        type="button"
        className="view-toggle__button"
        data-active={view === 'list'}
        aria-pressed={view === 'list'}
        aria-label="Zur Listenansicht wechseln"
        title="Listenansicht"
        onClick={() => onChange('list')}
      >
        <List size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="view-toggle__button"
        data-active={view === 'grid'}
        aria-pressed={view === 'grid'}
        aria-label="Zur Kachelansicht wechseln"
        title="Kachelansicht"
        onClick={() => onChange('grid')}
      >
        <LayoutGrid size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export default memo(ViewToggle);
