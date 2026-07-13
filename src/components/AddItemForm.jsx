import {
  forwardRef,
  memo,
  useCallback,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Plus } from 'lucide-react';
import { buildSuggestions } from '../lib/suggestions';
import ProductIcon from './ProductIcon';
import { normalizeName } from '../lib/history';

// Kennzeichnung der Vorschlagsquelle; Basisartikel erhalten bewusst kein Tag.
const SOURCE_LABEL = {
  history: 'Verlauf',
  favorite: 'Favorit',
};

/** Ein einzelner Vorschlagseintrag inkl. passendem Icon. */
const SuggestionRow = memo(function SuggestionRow({ suggestion, active, onPick, onHover }) {
  return (
    <li>
      <button
        type="button"
        className="suggestion"
        data-active={active}
        role="option"
        aria-selected={active}
        onMouseDown={(e) => e.preventDefault() /* Blur vor Klick verhindern */}
        onClick={() => onPick(suggestion)}
        onMouseEnter={onHover}
      >
        <ProductIcon
          name={suggestion.name}
          category={suggestion.category}
          className="suggestion__icon"
        />
        <span className="suggestion__name">{suggestion.name}</span>
        {SOURCE_LABEL[suggestion.source] && (
          <span className="suggestion__tag">{SOURCE_LABEL[suggestion.source]}</span>
        )}
      </button>
    </li>
  );
});

/**
 * Eingabefeld für neue Artikel. Stellt per Ref eine `focus()`-Methode bereit,
 * damit auch Aufrufer außerhalb des Formulars (z. B. nach dem Hinzufügen über
 * einen Chip) den Fokus sinnvoll auf das Eingabefeld zurücklegen können, statt
 * ihn beim Verschwinden des angeklickten Elements zu verlieren.
 */
const AddItemForm = forwardRef(function AddItemForm(
  { onAdd, history, favorites, existingNames },
  forwardedRef,
) {
  const [value, setValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const listId = useId();

  useImperativeHandle(forwardedRef, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const suggestions = useMemo(
    () => buildSuggestions(value, { history, favorites, excludeNames: existingNames }),
    [value, history, favorites, existingNames],
  );

  const showSuggestions = focused && suggestions.length > 0;

  const commit = useCallback(
    (name, category) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      onAdd(trimmed, category);
      setValue('');
      setActiveIndex(-1);
      inputRef.current?.focus();
    },
    [onAdd],
  );

  const handleChange = useCallback((e) => {
    setValue(e.target.value);
    setActiveIndex(-1);
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        const s = suggestions[activeIndex];
        commit(s.name, s.category);
      } else {
        commit(value);
      }
    },
    [activeIndex, suggestions, commit, value],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!showSuggestions) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      } else if (e.key === 'Escape') {
        setActiveIndex(-1);
        setFocused(false);
      }
    },
    [showSuggestions, suggestions.length],
  );

  return (
    <form className="add-form" onSubmit={handleSubmit} role="search">
      <div className="add-form__row">
        <input
          ref={inputRef}
          className="add-form__input"
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Artikel hinzufügen …"
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          aria-label="Artikel hinzufügen"
          aria-expanded={showSuggestions}
          aria-controls={listId}
          aria-autocomplete="list"
          role="combobox"
        />
        <button type="submit" className="add-form__submit" aria-label="Hinzufügen">
          <Plus size={22} aria-hidden="true" />
        </button>
      </div>

      {showSuggestions && (
        <ul className="suggestions" id={listId} role="listbox">
          {suggestions.map((s, i) => (
            <SuggestionRow
              key={normalizeName(s.name)}
              suggestion={s}
              active={i === activeIndex}
              onPick={(picked) => commit(picked.name, picked.category)}
              onHover={() => setActiveIndex(i)}
            />
          ))}
        </ul>
      )}
    </form>
  );
});

export default memo(AddItemForm);
