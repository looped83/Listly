import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { getItemIcon } from '../lib/icons';
import { normalizeName } from '../lib/history';

/** Schnellauswahl häufig gekaufter Artikel (aus dem Kaufverlauf). */
function FrequentChips({ items, onAdd }) {
  if (items.length === 0) return null;

  return (
    <section className="chips" aria-label="Häufig gekauft">
      <h2 className="chips__heading">
        <Sparkles size={14} aria-hidden="true" />
        Häufig gekauft
      </h2>
      <div className="chips__list">
        {items.map((entry) => {
          const Icon = getItemIcon(entry.name, entry.category);
          return (
            <button
              key={normalizeName(entry.name)}
              type="button"
              className="chip"
              onClick={() => onAdd(entry.name, entry.category)}
            >
              <Icon size={16} className="chip__icon" aria-hidden="true" />
              {entry.name}
              <span className="chip__count">×{entry.count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default memo(FrequentChips);
