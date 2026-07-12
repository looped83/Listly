import { memo } from 'react';
import { Sparkles, X } from 'lucide-react';
import { getItemIcon } from '../lib/icons';
import { normalizeName } from '../lib/history';

/**
 * Schnellauswahl häufig gekaufter Artikel (aus dem Kaufverlauf).
 * Horizontal scrollbar; jeder Chip ist antippbar (hinzufügen) und über das
 * kleine ×-Symbol aus den Vorschlägen entfernbar (löscht ihn aus dem Verlauf).
 */
function FrequentChips({ items, onAdd, onRemove }) {
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
            <div className="chip" key={normalizeName(entry.name)}>
              <button
                type="button"
                className="chip__add"
                onClick={() => onAdd(entry.name, entry.category)}
              >
                <Icon size={16} className="chip__icon" aria-hidden="true" />
                <span className="chip__name">{entry.name}</span>
                <span className="chip__count">×{entry.count}</span>
              </button>
              <button
                type="button"
                className="chip__remove"
                onClick={() => onRemove(entry.name)}
                aria-label={`${entry.name} aus Vorschlägen entfernen`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default memo(FrequentChips);
