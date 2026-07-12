import { memo } from 'react';
import { Sparkles, X } from 'lucide-react';
import ProductIcon from './ProductIcon';
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
          return (
            <div className="chip" key={normalizeName(entry.name)}>
              <button
                type="button"
                className="chip__add"
                onClick={() => onAdd(entry.name, entry.category)}
              >
                <ProductIcon name={entry.name} category={entry.category} className="chip__icon" />
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
