import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useTheme } from './hooks/useTheme';
import { STORAGE_KEYS } from './lib/storage';
import { cleanName, normalizeName, recordPurchase } from './lib/history';
import { getKnownCategory } from './lib/icons';
import { frequentSuggestions } from './lib/suggestions';
import ThemeToggle from './components/ThemeToggle';
import AddItemForm from './components/AddItemForm';
import FrequentChips from './components/FrequentChips';
import ShoppingList from './components/ShoppingList';
import { ShoppingBasket } from 'lucide-react';

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function App() {
  const [items, setItems] = useLocalStorage(STORAGE_KEYS.items, []);
  const [favorites, setFavorites] = useLocalStorage(STORAGE_KEYS.favorites, []);
  const [history, setHistory] = useLocalStorage(STORAGE_KEYS.history, {});
  const { preference, cycleTheme } = useTheme();

  // Abgeleitete Nachschlage-Sets – memoisiert, um unnötige Neuberechnungen zu vermeiden.
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

  const addItem = useCallback(
    (rawName, category) => {
      const name = cleanName(rawName);
      const key = normalizeName(name);
      if (!key) return;

      setItems((prev) => {
        const existing = prev.find((item) => normalizeName(item.name) === key);
        // Bereits vorhanden: reaktivieren statt Dublette anzulegen.
        if (existing) {
          return existing.checked
            ? prev.map((item) => (item.id === existing.id ? { ...item, checked: false } : item))
            : prev;
        }
        const resolvedCategory = category ?? getKnownCategory(name);
        return [...prev, { id: createId(), name, category: resolvedCategory, checked: false }];
      });
    },
    [setItems],
  );

  const toggleItem = useCallback(
    (id) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
      );
    },
    [setItems],
  );

  const removeItem = useCallback(
    (id) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [setItems],
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

  // Erledigte Artikel im Kaufverlauf verbuchen (Häufigkeit ++) und aus der Liste entfernen.
  const clearChecked = useCallback(() => {
    setItems((prev) => {
      const checked = prev.filter((item) => item.checked);
      if (checked.length > 0) {
        setHistory((prevHistory) =>
          checked.reduce((acc, item) => recordPurchase(acc, item), prevHistory),
        );
      }
      return prev.filter((item) => !item.checked);
    });
  }, [setItems, setHistory]);

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <span className="header__logo">
            <ShoppingBasket size={24} aria-hidden="true" />
          </span>
          <div>
            <h1 className="header__title">Listly</h1>
            <p className="header__subtitle">Deine vegane Einkaufsliste</p>
          </div>
        </div>
        <ThemeToggle preference={preference} onCycle={cycleTheme} />
      </header>

      <main className="content">
        <ShoppingList
          items={items}
          favoriteSet={favoriteSet}
          onToggle={toggleItem}
          onToggleFavorite={toggleFavorite}
          onRemove={removeItem}
          onClearChecked={clearChecked}
        />
      </main>

      {/* Untere Eingabeleiste – in Daumen-Reichweite, direkt nutzbar. */}
      <div className="dock">
        <FrequentChips items={frequentItems} onAdd={addItem} />
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
