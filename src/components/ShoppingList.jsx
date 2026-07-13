import { memo, useMemo } from 'react';
import { ClipboardList, ShoppingBag } from 'lucide-react';
import ListItem from './ListItem';
import { normalizeName } from '../lib/history';
import { groupByCategory } from '../lib/groupItems';

/** Rendert die aktuelle Liste: offene und erledigte Artikel je nach Kategorie gruppiert. */
function ShoppingList({
  items,
  favoriteSet,
  onToggle,
  onToggleFavorite,
  onRemove,
  onEdit,
  onCheckout,
}) {
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
        onEdit={onEdit}
      />
    ));

  const renderGroup = (group) => {
    const count = group.items.length;
    return (
      <div className="list-group" key={group.category.id}>
        {/*
          aria-label ersetzt den vorgelesenen Namen der Überschrift durch einen
          vollständigen Satz („Obst & Gemüse, 3 Artikel“) – die sichtbaren
          Kind-Elemente (Name + Zähler-Badge) bleiben dabei rein visuell.
        */}
        <h3
          className="list-group__header"
          aria-label={`${group.category.name}, ${count} Artikel`}
        >
          <span aria-hidden="true">{group.category.name}</span>
          <span className="list-group__count" aria-hidden="true">
            {count}
          </span>
        </h3>
        <ul className="list">{renderItems(group.items)}</ul>
      </div>
    );
  };

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
