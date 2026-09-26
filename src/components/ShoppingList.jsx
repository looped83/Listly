import { memo, useId, useMemo, useState } from 'react';
import { ChevronDown, ClipboardList, CloudOff, ShoppingBag } from 'lucide-react';
import ListItem from './ListItem';
import TileItem from './TileItem';
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

// Anzahl der Platzhalterzeilen beim ersten Laden – grob eine Bildschirmhöhe.
const SKELETON_ROWS = 5;

/**
 * Leere Liste, deren Stand noch nicht bekannt ist (Cloud-Modus, erster Start
 * ohne Cache): Platzhalterzeilen beim Laden bzw. ein Offline-Hinweis – statt
 * eines irreführenden „Deine Liste ist leer“.
 */
function UnknownListState({ offline }) {
  if (offline) {
    return (
      <div className="empty">
        <CloudOff size={40} className="empty__icon" aria-hidden="true" />
        <p className="empty__title">Keine Verbindung</p>
        <p className="empty__text">Die Liste erscheint, sobald du wieder online bist.</p>
      </div>
    );
  }
  return (
    <div className="skeleton" aria-busy="true">
      <span className="visually-hidden">Liste wird geladen …</span>
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div key={i} className="skeleton__row" aria-hidden="true" />
      ))}
    </div>
  );
}

/**
 * Rendert die aktuelle Liste: offene und erledigte Artikel je nach Kategorie
 * gruppiert. Einkaufsorientierter Standard-Look: große Zeilen, Fortschritts-
 * anzeige ab dem ersten abgehakten Artikel und standardmäßig eingeklappte
 * erledigte Artikel.
 *
 * `loadState` unterscheidet bei leerer Liste „wirklich leer“ (`ready`) von
 * „noch nicht geladen“ (`loading`) und „nicht ladbar, offline“ (`offline`).
 */
function ShoppingList({
  items,
  loadState = 'ready',
  favoriteSet,
  editingId,
  viewMode = 'list',
  onToggle,
  onToggleFavorite,
  onRemove,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  findEditConflict,
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
    if (loadState !== 'ready') return <UnknownListState offline={loadState === 'offline'} />;
    return (
      <div className="empty">
        <ClipboardList size={40} className="empty__icon" aria-hidden="true" />
        <p className="empty__title">Deine Liste ist leer</p>
        <p className="empty__text">Tippe auf das Plus unten rechts, um Artikel hinzuzufügen.</p>
      </div>
    );
  }

  // Beide Ansichten teilen sich Daten, State und Handler – nur die
  // Item-Komponente (Zeile/Karte) und ihr Container unterscheiden sich.
  const ItemComponent = viewMode === 'grid' ? TileItem : ListItem;

  const renderItems = (list) => {
    const children = list.map((item) => (
      <ItemComponent
        key={item.id}
        item={item}
        isFavorite={favoriteSet.has(normalizeName(item.name))}
        isEditing={item.id === editingId}
        onToggle={onToggle}
        onToggleFavorite={onToggleFavorite}
        onRemove={onRemove}
        onEdit={onEdit}
        onSave={onSaveEdit}
        onCancelEdit={onCancelEdit}
        findConflict={findEditConflict}
      />
    ));
    return viewMode === 'grid' ? (
      <ul className="tile-grid">{children}</ul>
    ) : (
      <ul className="list">{children}</ul>
    );
  };

  const renderGroup = (group) => (
    <div className="list-group" key={group.category.id}>
      <h2 className="list-group__header">{group.category.name}</h2>
      {renderItems(group.items)}
    </div>
  );

  return (
    // key sorgt beim Ansichtswechsel für einen frischen Mount samt kurzer
    // Ein-/Ausblend-Animation (siehe .view-transition); respektiert
    // prefers-reduced-motion über CSS.
    <div className="view-transition" key={viewMode}>
      <section aria-label="Offene Artikel">
        {/* Fortschritt erst zeigen, sobald der erste Artikel abgehakt wurde. */}
        {summary.checkedCount > 0 && (
          <ShopProgress done={summary.checkedCount} total={summary.total} />
        )}
        {open.length > 0 ? (
          openGroups.map((group) => renderGroup(group))
        ) : (
          <p className="empty__text empty__text--inline">Alles erledigt! 🎉</p>
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
    </div>
  );
}

export default memo(ShoppingList);
