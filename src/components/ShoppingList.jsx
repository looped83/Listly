import { memo, useId, useMemo, useState } from 'react';
import { ChevronDown, ClipboardList, ShoppingBag } from 'lucide-react';
import ListItem from './ListItem';
import { normalizeName } from '../lib/history';
import { groupByCategory } from '../lib/groupItems';
import { summarizeCheckout } from '../lib/checkout';

/** Fortschrittsleiste „x von y erledigt“ – erscheint nach dem ersten Abhaken. */
function ShopProgress({ done, total }) {
  const label = `${done} von ${total} erledigt`;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="shop-progress">
      <span className="shop-progress__label">{label}</span>
      <div
        className="shop-progress__track"
        role="progressbar"
        aria-label="Einkaufsfortschritt"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={label}
      >
        <div className="shop-progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Rendert die aktuelle Liste: offene und erledigte Artikel je nach Kategorie
 * gruppiert. Einkaufsorientierter Standard-Look: große Zeilen, Fortschritts-
 * anzeige ab dem ersten abgehakten Artikel und standardmäßig eingeklappte
 * erledigte Artikel.
 */
function ShoppingList({
  items,
  favoriteSet,
  onToggle,
  onToggleFavorite,
  onRemove,
  onEdit,
  onCheckout,
}) {
  const doneId = useId();
  // Erledigte standardmäßig eingeklappt.
  const [doneOpen, setDoneOpen] = useState(false);

  const { open, done } = useMemo(() => {
    const groups = { open: [], done: [] };
    for (const item of items) (item.checked ? groups.done : groups.open).push(item);
    return groups;
  }, [items]);

  const summary = useMemo(() => summarizeCheckout(items), [items]);
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
        </div>
        {/* Fortschritt erst zeigen, sobald der erste Artikel abgehakt wurde. */}
        {summary.checkedCount > 0 && (
          <ShopProgress done={summary.checkedCount} total={summary.total} />
        )}
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
          {/* Disclosure: erledigte Artikel standardmäßig eingeklappt. */}
          <button
            type="button"
            className="disclosure"
            aria-expanded={doneOpen}
            aria-controls={doneId}
            onClick={() => setDoneOpen((prev) => !prev)}
          >
            <span className="list-section__title">Erledigt</span>
            <span className="list-section__count">{done.length}</span>
            <ChevronDown
              size={18}
              className="disclosure__chevron"
              data-open={doneOpen}
              aria-hidden="true"
            />
          </button>
          {doneOpen && <div id={doneId}>{doneGroups.map((group) => renderGroup(group))}</div>}
          {/* Primäre Aktion – stets sichtbar, auch wenn die Liste eingeklappt ist,
              sonst gäbe es keinen Weg, den Einkauf abzuschließen. */}
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
