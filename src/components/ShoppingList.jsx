import { memo, useMemo } from 'react';
import { ClipboardList, ShoppingBag } from 'lucide-react';
import ListItem from './ListItem';
import { normalizeName } from '../lib/history';
import { categoryInfo } from '../lib/icons';

/** Artikel nach Kategorie gruppieren (in Kategorie-Reihenfolge). */
function groupByCategory(list) {
  const byCategory = new Map();
  for (const item of list) {
    const key = item.category || '__other';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(item);
  }
  return [...byCategory.entries()]
    .map(([key, items]) => ({ info: categoryInfo(key === '__other' ? null : key), items }))
    .sort((a, b) => a.info.order - b.info.order);
}

/** Rendert die aktuelle Liste: offene und erledigte Artikel je nach Kategorie gruppiert. */
function ShoppingList({ items, favoriteSet, onToggle, onToggleFavorite, onRemove, onCheckout }) {
  const { open, done } = useMemo(() => {
    const groups = { open: [], done: [] };
    for (const item of items) (item.checked ? groups.done : groups.open).push(item);
    return groups;
  }, [items]);

  const openGroups = useMemo(() => groupByCategory(open), [open]);
  const doneGroups = useMemo(() => groupByCategory(done), [done]);

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

  const renderGroup = (group) => (
    <div className="list-group" key={group.info.id}>
      <h3 className="list-group__header">{group.info.name}</h3>
      <ul className="list">{renderItems(group.items)}</ul>
    </div>
  );

  return (
    <>
      <section aria-label="Offene Artikel">
        <div className="list-section__header">
          <h2 className="list-section__title">Einkaufsliste</h2>
          <span className="list-section__count">{open.length} offen</span>
        </div>
        {open.length > 0 ? (
          openGroups.map((group) => renderGroup(group))
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
          {doneGroups.map((group) => renderGroup(group))}
          {/* Primäre Aktion – nur sichtbar, wenn es abgehakte Artikel gibt, sonst
              gäbe es nichts abzuschließen. */}
          <div className="list-actions">
            <button type="button" className="button-checkout" onClick={onCheckout}>
              <ShoppingBag size={18} aria-hidden="true" />
              Einkauf abschließen
            </button>
          </div>
        </section>
      )}
    </>
  );
}

export default memo(ShoppingList);
