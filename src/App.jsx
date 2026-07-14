import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useSystemTheme } from './hooks/useTheme';
import { useShoppingItems } from './hooks/useShoppingItems';
import { ToastProvider, useToast } from './hooks/useToast';
import { STORAGE_KEYS } from './lib/storage';
import { cleanName, normalizeName, recordPurchase } from './lib/history';
import { itemLabel } from './lib/itemFields';
import { frequentSuggestions } from './lib/suggestions';
import { summarizeCheckout } from './lib/checkout';
import { CHECKOUT_MESSAGES, LOVE_MESSAGES, randomFrom } from './lib/love';
import ShoppingList from './components/ShoppingList';
import AddItemSheet from './components/AddItemSheet';
import CheckoutDialog from './components/CheckoutDialog';
import SyncStatus from './components/SyncStatus';
import LoveHearts from './components/LoveHearts';
import ViewToggle from './components/ViewToggle';
import { Plus, ShoppingBasket, Wallet } from 'lucide-react';

// Kundenkarten-Overlay lazy laden: es zieht qrcode + jsbarcode nach, die erst
// beim Öffnen der Karten gebraucht werden. So bleiben sie aus dem Initial-Bundle.
const CardsSheet = lazy(() => import('./components/CardsSheet'));

// ── Easter Eggs (liebevolle Überraschungen beim Einkaufen) ───────────────────
// Wahrscheinlichkeit, dass beim Abhaken ein Herz aufschwebt – selten genug,
// damit es etwas Besonderes bleibt.
const CHECK_HEART_CHANCE = 0.14;
// Logo-Geheimnis: so viele schnelle Tipps aufs Logo lösen es aus …
const LOGO_TAPS_TO_UNLOCK = 5;
// … solange die Tipps jeweils dichter als so viele ms aufeinander folgen.
const LOGO_TAP_WINDOW_MS = 800;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

function AppContent() {
  const [favorites, setFavorites] = useLocalStorage(STORAGE_KEYS.favorites, []);
  const [history, setHistory] = useLocalStorage(STORAGE_KEYS.history, {});
  const [storedViewMode, setViewMode] = useLocalStorage(STORAGE_KEYS.viewMode, 'list');
  // Unbekannter/beschädigter Wert fällt defensiv auf die Listenansicht zurück.
  const viewMode = storedViewMode === 'grid' ? 'grid' : 'list';
  const [cardsOpen, setCardsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  // Easter Egg: eine laufende Herz-Animation ({ id, count }) oder null.
  const [loveBurst, setLoveBurst] = useState(null);
  const logoTaps = useRef({ count: 0, last: 0 });
  const { notify } = useToast();
  useSystemTheme();

  const closeCards = useCallback(() => setCardsOpen(false), []);
  const closeCheckout = useCallback(() => setCheckoutOpen(false), []);
  const closeEdit = useCallback(() => setEditingId(null), []);
  const closeAddSheet = useCallback(() => setAddSheetOpen(false), []);

  // Easter Egg: Herzen aufschweben lassen (bei reduzierter Bewegung stattdessen
  // eine liebevolle Textmeldung, damit die Überraschung trotzdem ankommt).
  const showLoveHearts = useCallback(
    (count) => {
      if (prefersReducedMotion()) {
        notify(randomFrom(LOVE_MESSAGES), { tone: 'success' });
      } else {
        setLoveBurst({ id: Date.now(), count });
      }
    },
    [notify],
  );
  const clearLoveBurst = useCallback(() => setLoveBurst(null), []);

  // Logo-Geheimnis: mehrere schnelle Tipps aufs Logo → Liebesbotschaft + Herzen.
  const handleLogoTap = useCallback(() => {
    const now = Date.now();
    const previous = logoTaps.current;
    const count = now - previous.last < LOGO_TAP_WINDOW_MS ? previous.count + 1 : 1;
    logoTaps.current = { count, last: now };
    if (count < LOGO_TAPS_TO_UNLOCK) return;
    logoTaps.current = { count: 0, last: 0 };
    notify(randomFrom(LOVE_MESSAGES), { tone: 'success', duration: 6000 });
    if (!prefersReducedMotion()) setLoveBurst({ id: Date.now(), count: 16 });
  }, [notify]);

  // Erledigte Artikel im (lokalen) Kaufverlauf verbuchen. Reiner State-Update:
  // recordPurchase ist immutabel, daher unter StrictMode kein Doppelverbuchen.
  const handlePurchase = useCallback(
    (purchased) => {
      setHistory((prev) => purchased.reduce((acc, item) => recordPurchase(acc, item), prev));
    },
    [setHistory],
  );

  const {
    items,
    status,
    addItem,
    toggleItem,
    updateItem,
    removeItem,
    restoreItems,
    completeCheckout,
  } = useShoppingItems({ onPurchase: handlePurchase });

  // Abgeleitete Kennzahlen für den Abschluss-Dialog – reine Berechnung.
  const checkoutSummary = useMemo(() => summarizeCheckout(items), [items]);

  const editingItem = useMemo(
    () => items.find((it) => it.id === editingId) ?? null,
    [items, editingId],
  );

  // Konflikt beim Umbenennen: ein ANDERER Artikel mit demselben (normalisierten)
  // Namen. Wird vom Edit-Dialog zur Zusammenführungs-Abfrage genutzt.
  const findEditConflict = useCallback(
    (name) => {
      const key = normalizeName(name);
      return items.find((it) => it.id !== editingId && normalizeName(it.name) === key) ?? null;
    },
    [items, editingId],
  );

  // Favorit einer Umbenennung folgen lassen (konsistenter Favoritenbezug).
  const renameFavorite = useCallback(
    (oldName, newName) => {
      const oldKey = normalizeName(oldName);
      const newKey = normalizeName(newName);
      if (oldKey === newKey) return;
      setFavorites((prev) => {
        if (!prev.some((fav) => normalizeName(fav) === oldKey)) return prev; // war kein Favorit
        const withoutOld = prev.filter((fav) => normalizeName(fav) !== oldKey);
        return withoutOld.some((fav) => normalizeName(fav) === newKey)
          ? withoutOld
          : [...withoutOld, newName];
      });
    },
    [setFavorites],
  );

  // Artikel-Bearbeitung speichern. Bei mergeTargetId werden zwei gleichnamige
  // Artikel zusammengeführt: der bearbeitete Artikel gewinnt (behält id/Position),
  // der andere wird entfernt. Favoriten folgen der Umbenennung.
  const handleSaveEdit = useCallback(
    (patch, mergeTargetId) => {
      if (!editingItem) return;
      const oldName = editingItem.name;

      updateItem(editingItem.id, patch);
      if (mergeTargetId) removeItem(mergeTargetId);
      renameFavorite(oldName, patch.name);

      setEditingId(null);
      notify(`„${patch.name}“ aktualisiert`);
    },
    [editingItem, updateItem, removeItem, renameFavorite, notify],
  );

  // Zentrale Hinzufügen-Logik für ALLE Eingabequellen (Suche im Hinzufügen-Sheet,
  // Vorschläge, Häufig-gekauft-Chips): addItem liefert synchron ein eindeutiges
  // Ergebnis statt still zu bleiben, sodass Dubletten (offen oder erledigt)
  // einheitlich und über die Toast-/aria-live-Infrastruktur gemeldet werden.
  const handleAddItem = useCallback(
    (rawName, category, extras) => {
      const result = addItem(rawName, category, extras);

      if (result.status === 'added') {
        // Menge kompakt mitzeigen (z. B. „2 × Hafermilch“; 1 wird nicht gezeigt).
        notify(`„${itemLabel(result.item)}“ hinzugefügt`, { tone: 'success' });
      } else if (result.status === 'alreadyOpen') {
        notify(`„${result.item.name}“ steht bereits auf der Liste`);
      } else if (result.status === 'reactivated') {
        notify(`„${result.item.name}“ wurde wieder aktiviert`);
      }
    },
    [addItem, notify],
  );

  // Abhaken (aus der Zeile). Wird ein Artikel NEU als erledigt markiert, schwebt
  // selten ein Herz auf (Easter Egg) – nicht beim Wieder-Öffnen.
  const handleToggle = useCallback(
    (id) => {
      const current = items.find((it) => it.id === id);
      const willCheck = current ? !current.checked : false;
      toggleItem(id);
      if (willCheck && Math.random() < CHECK_HEART_CHANCE) showLoveHearts(3);
    },
    [items, toggleItem, showLoveHearts],
  );

  // Einzelnen Artikel löschen – mit Undo (Artikel unverändert wiederherstellen).
  const handleRemoveItem = useCallback(
    (id) => {
      const removed = removeItem(id);
      if (!removed) return;
      notify(`„${removed.name}“ gelöscht`, {
        action: { label: 'Rückgängig', onAction: () => restoreItems([removed]) },
      });
    },
    [removeItem, restoreItems, notify],
  );

  // Abschluss bestätigen (aus dem Dialog): verbucht die betroffenen Artikel und
  // entfernt sie – mit Undo, das den vollständigen Vorzustand wiederherstellt
  // (die Artikel UND den vorherigen Kaufverlauf).
  const handleConfirmCheckout = useCallback(
    (includeOpen) => {
      const historyBefore = history;
      const completed = completeCheckout(includeOpen);
      setCheckoutOpen(false);
      if (completed.length === 0) return;
      // Easter Egg: statt der nüchternen Anzahl eine liebevolle Botschaft – das
      // Rückgängigmachen bleibt darüber erreichbar.
      notify(randomFrom(CHECKOUT_MESSAGES), {
        tone: 'success',
        action: {
          label: 'Rückgängig',
          onAction: () => {
            setHistory(historyBefore);
            restoreItems(completed);
          },
        },
      });
    },
    [completeCheckout, history, setHistory, restoreItems, notify],
  );

  // Abgeleitete Nachschlage-Sets – memoisiert gegen unnötige Neuberechnungen.
  const existingNames = useMemo(
    () => new Set(items.map((item) => normalizeName(item.name))),
    [items],
  );
  const favoriteSet = useMemo(
    () => new Set(favorites.map((name) => normalizeName(name))),
    [favorites],
  );
  const frequentItems = useMemo(
    () => frequentSuggestions(history, { excludeNames: existingNames }),
    [history, existingNames],
  );

  const toggleFavorite = useCallback(
    (rawName) => {
      const name = cleanName(rawName);
      const key = normalizeName(name);
      setFavorites((prev) =>
        prev.some((fav) => normalizeName(fav) === key)
          ? prev.filter((fav) => normalizeName(fav) !== key)
          : [...prev, name],
      );
    },
    [setFavorites],
  );

  // Einen Artikel aus dem Kaufverlauf (und damit den Vorschlags-Chips) löschen.
  const removeFromHistory = useCallback(
    (rawName) => {
      const key = normalizeName(rawName);
      setHistory((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [setHistory],
  );

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          {/* Das Logo trägt ein verstecktes Easter Egg: mehrere schnelle Tipps
              zaubern eine kleine Liebesbotschaft. Bewusst rein dekorativ (kein
              Button/keine Ansage) – es soll ein Geheimnis bleiben. */}
          <span className="header__logo" onClick={handleLogoTap}>
            <ShoppingBasket size={24} aria-hidden="true" />
          </span>
          <h1 className="header__title">Listly</h1>
        </div>
        <div className="header__actions">
          <ViewToggle view={viewMode} onChange={setViewMode} />
          <button
            type="button"
            className="icon-button icon-button--header"
            onClick={() => setCardsOpen(true)}
            aria-label="Kundenkarten öffnen"
            title="Kundenkarten"
          >
            <Wallet size={20} aria-hidden="true" />
          </button>
          <SyncStatus status={status} />
        </div>
      </header>

      <main className="content">
        <ShoppingList
          items={items}
          favoriteSet={favoriteSet}
          editingId={editingId}
          viewMode={viewMode}
          onToggle={handleToggle}
          onToggleFavorite={toggleFavorite}
          onRemove={handleRemoveItem}
          onEdit={setEditingId}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={closeEdit}
          findEditConflict={findEditConflict}
          onCheckout={() => setCheckoutOpen(true)}
        />
      </main>

      {/* Zentrale Hinzufügen-Interaktion: schwebender Plus-Button, öffnet das
          Hinzufügen-Sheet mit Suche und allen Detailfeldern. */}
      <button
        type="button"
        className="fab"
        onClick={() => setAddSheetOpen(true)}
        aria-label="Artikel hinzufügen"
      >
        <Plus size={26} aria-hidden="true" />
      </button>

      {addSheetOpen && (
        <AddItemSheet
          history={history}
          favorites={favorites}
          existingNames={existingNames}
          frequentItems={frequentItems}
          onAdd={handleAddItem}
          onRemoveFromHistory={removeFromHistory}
          onClose={closeAddSheet}
        />
      )}

      {cardsOpen && (
        <Suspense fallback={null}>
          <CardsSheet onClose={closeCards} />
        </Suspense>
      )}

      {checkoutOpen && (
        <CheckoutDialog
          checkedCount={checkoutSummary.checkedCount}
          openCount={checkoutSummary.openCount}
          onConfirm={handleConfirmCheckout}
          onClose={closeCheckout}
        />
      )}

      {loveBurst && (
        <LoveHearts key={loveBurst.id} count={loveBurst.count} onDone={clearLoveBurst} />
      )}
    </div>
  );
}
