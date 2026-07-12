import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useSystemTheme } from './hooks/useTheme';
import { useShoppingItems } from './hooks/useShoppingItems';
import { STORAGE_KEYS } from './lib/storage';
import { cleanName, normalizeName, recordPurchase } from './lib/history';
import { frequentSuggestions } from './lib/suggestions';
import AddItemForm from './components/AddItemForm';
import FrequentChips from './components/FrequentChips';
import ShoppingList from './components/ShoppingList';
import SyncStatus from './components/SyncStatus';
import { ShoppingBasket } from 'lucide-react';

export default function App() {
  const [favorites, setFavorites] = useLocalStorage(STORAGE_KEYS.favorites, []);
  const [history, setHistory] = useLocalStorage(STORAGE_KEYS.history, {});
  useSystemTheme();

  // Erledigte Artikel im (lokalen) Kaufverlauf verbuchen.
  const handlePurchase = useCallback(
    (purchased) => {
      setHistory((prev) => purchased.reduce((acc, item) => recordPurchase(acc, item), prev));
    },
    [setHistory],
  );

  const { items, status, addItem, toggleItem, removeItem, clearChecked } = useShoppingItems({
    onPurchase: handlePurchase,
  });

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
        <SyncStatus status={status} />
      </header>

      <main className="content">
        <FrequentChips items={frequentItems} onAdd={addItem} onRemove={removeFromHistory} />
        <ShoppingList
          items={items}
          favoriteSet={favoriteSet}
          onToggle={toggleItem}
          onToggleFavorite={toggleFavorite}
          onRemove={removeItem}
          onClearChecked={clearChecked}
        />
      </main>

      {/* Untere Eingabeleiste – positionsstabil, in Daumen-Reichweite. */}
      <div className="dock">
        <AddItemForm
          onAdd={addItem}
          history={history}
          favorites={favorites}
          existingNames={existingNames}
        />
      </div>
    </div>
  );
}
