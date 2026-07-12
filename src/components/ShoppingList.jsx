import { memo, useMemo } from 'react';
import { ClipboardList, Trash2 } from 'lucide-react';
import ListItem from './ListItem';
import { normalizeName } from '../lib/history';

/** Rendert die aktuelle Liste, getrennt nach offen und erledigt. */
function ShoppingList({ items, favoriteSet, onToggle, onToggleFavorite, onRemove, onClearChecked }) {
  const { open, done } = useMemo(() => {
    const groups = { open: [], done: [] };
    for (const item of items) (item.checked ? groups.done : groups.open).push(item);
    return groups;
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="empty">
        <ClipboardList size={40} className="empty__icon" aria-hidden="true" />
        <p className="empty__title">Deine Liste ist leer</p>
        <p className="empty__text">Tippe oben einen Artikel ein oder wähle einen Vorschlag.</p>
      </div>
    );
  }

  const renderItems = (list) =>
    list.map((item) => (
      <ListItem
        key={item.id}
        item={item}
        isFavorite={favoriteSet.has(normalizeName(item.name))}
        onToggle={onToggle}
        onToggleFavorite={onToggleFavorite}
        onRemove={onRemove}
      />
    ));

  return (
    <>
      <section aria-label="Offene Artikel">
        <div className="list-section__header">
          <h2 className="list-section__title">Einkaufsliste</h2>
          <span className="list-section__count">{open.length} offen</span>
        </div>
        {open.length > 0 ? (
          <ul className="list">{renderItems(open)}</ul>
        ) : (
          <p className="empty__text" style={{ paddingLeft: 4 }}>
            Alles erledigt! 🎉
          </p>
        )}
      </section>

      {done.length > 0 && (
        <section className="section" aria-label="Erledigte Artikel">
          <div className="list-section__header">
            <h2 className="list-section__title">Erledigt</h2>
            <span className="list-section__count">{done.length}</span>
          </div>
          <ul className="list">{renderItems(done)}</ul>
          <div className="list-actions">
            <button type="button" className="text-button" onClick={onClearChecked}>
              <Trash2 size={16} aria-hidden="true" />
              Erledigte entfernen &amp; verbuchen
            </button>
          </div>
        </section>
      )}
    </>
  );
}

export default memo(ShoppingList);
