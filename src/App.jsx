import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useSystemTheme } from './hooks/useTheme';
import { useShoppingItems } from './hooks/useShoppingItems';
import { ToastProvider, useToast } from './hooks/useToast';
import { STORAGE_KEYS } from './lib/storage';
import { cleanName, normalizeName, recordPurchase } from './lib/history';
import { frequentSuggestions } from './lib/suggestions';
import { summarizeCheckout } from './lib/checkout';
import AddItemForm from './components/AddItemForm';
import FrequentChips from './components/FrequentChips';
import ShoppingList from './components/ShoppingList';
import CheckoutDialog from './components/CheckoutDialog';
import ItemEditDialog from './components/ItemEditDialog';
import SyncStatus from './components/SyncStatus';
import { ShoppingBasket, Wallet } from 'lucide-react';

// Kundenkarten-Overlay lazy laden: es zieht qrcode + jsbarcode nach, die erst
// beim Öffnen der Karten gebraucht werden. So bleiben sie aus dem Initial-Bundle.
const CardsSheet = lazy(() => import('./components/CardsSheet'));

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
  const [cardsOpen, setCardsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { notify } = useToast();
  useSystemTheme();

  const closeCards = useCallback(() => setCardsOpen(false), []);
  const closeCheckout = useCallback(() => setCheckoutOpen(false), []);
  const closeEdit = useCallback(() => setEditingId(null), []);

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

  // Ref auf das Eingabefeld (Dock): erlaubt es jeder Hinzufügen-Quelle (Tippen,
  // Autovervollständigung, Chips), den Fokus nach dem Hinzufügen sinnvoll dorthin
  // zurückzulegen – auch wenn das angeklickte Element (z. B. ein Chip) danach aus
  // dem DOM verschwindet und sonst der Fokus verloren ginge.
  const addFormRef = useRef(null);

  // Zentrale Hinzufügen-Logik für ALLE Eingabequellen (manuelle Eingabe,
  // Autovervollständigung, Häufig-gekauft-Chips): addItem liefert synchron ein
  // eindeutiges Ergebnis statt still zu bleiben, sodass Dubletten (offen oder
  // erledigt) einheitlich und über die Toast-/aria-live-Infrastruktur gemeldet
  // werden.
  const handleAddItem = useCallback(
    (rawName, category) => {
      const result = addItem(rawName, category);

      if (result.status === 'added') {
        notify(`„${result.item.name}“ hinzugefügt`, { tone: 'success' });
      } else if (result.status === 'alreadyOpen') {
        notify(`„${result.item.name}“ steht bereits auf der Liste`);
      } else if (result.status === 'reactivated') {
        notify(`„${result.item.name}“ wurde wieder aktiviert`);
      }

      addFormRef.current?.focus();
    },
    [addItem, notify],
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
      const label =
        completed.length === 1 ? '1 Artikel abgeschlossen' : `${completed.length} Artikel abgeschlossen`;
      notify(label, {
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
          <span className="header__logo">
            <ShoppingBasket size={24} aria-hidden="true" />
          </span>
          <h1 className="header__title">Listly</h1>
        </div>
        <div className="header__actions">
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
        <FrequentChips items={frequentItems} onAdd={handleAddItem} onRemove={removeFromHistory} />
        <ShoppingList
          items={items}
          favoriteSet={favoriteSet}
          onToggle={toggleItem}
          onToggleFavorite={toggleFavorite}
          onRemove={handleRemoveItem}
          onEdit={setEditingId}
          onCheckout={() => setCheckoutOpen(true)}
        />
      </main>

      {/* Untere Eingabeleiste – positionsstabil, in Daumen-Reichweite. */}
      <div className="dock">
        <AddItemForm
          ref={addFormRef}
          onAdd={handleAddItem}
          history={history}
          favorites={favorites}
          existingNames={existingNames}
        />
      </div>

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

      {editingItem && (
        <ItemEditDialog
          item={editingItem}
          findConflict={findEditConflict}
          onSave={handleSaveEdit}
          onClose={closeEdit}
        />
      )}
    </div>
  );
}
