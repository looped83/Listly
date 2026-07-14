import { memo, useCallback, useId, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { buildSuggestions } from '../lib/suggestions';
import { normalizeName } from '../lib/history';
import { CATEGORY_OPTIONS } from '../lib/icons';
import { useDialogFocus } from '../hooks/useDialogFocus';
import FrequentChips from './FrequentChips';
import ProductIcon from './ProductIcon';
import QuantityStepper, { MIN_QUANTITY } from './QuantityStepper';

const SOURCE_LABEL = { history: 'Verlauf', favorite: 'Favorit' };

/**
 * Bottom-Sheet zum Hinzufügen eines Artikels: Produktsuche mit
 * Autovervollständigung, Häufig-gekauft-Chips und den Detailfeldern
 * (Menge, Kategorie) in einem Schritt.
 *
 * Interaktionsmodell:
 *  - Chip antippen  → sofort hinzufügen und Sheet schließen.
 *  - Vorschlag wählen → Name (+ Kategorie) ins Formular übernehmen, um Details zu ergänzen.
 *  - „Hinzufügen“  → Name + Menge/Kategorie übernehmen und Sheet schließen.
 *
 * Barrierefreiheit via useDialogFocus (Fokusfalle, Escape, initialer Fokus auf
 * dem Suchfeld, Fokusrückgabe an den auslösenden Button).
 *
 * @param {{
 *   history: object, favorites: string[], existingNames: Set<string>,
 *   frequentItems: Array, onAdd: (name: string, category?: string, extras?: object) => void,
 *   onRemoveFromHistory: (name: string) => void, onClose: () => void,
 * }} props
 */
function AddItemSheet({
  history,
  favorites,
  existingNames,
  frequentItems,
  onAdd,
  onRemoveFromHistory,
  onClose,
}) {
  const [name, setName] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const [category, setCategory] = useState('');
  // Nach dem Übernehmen eines Vorschlags die Liste schließen, obwohl der
  // übernommene Name selbst noch zu Vorschlägen passt. Beim nächsten Tippen
  // (onChange) wird sie wieder eingeblendet.
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  const searchRef = useRef(null);
  const { panelRef, onKeyDown } = useDialogFocus({ onClose, initialFocusRef: searchRef });

  const titleId = useId();
  const listId = useId();

  const suggestions = useMemo(
    () => buildSuggestions(name, { history, favorites, excludeNames: existingNames }),
    [name, history, favorites, existingNames],
  );
  const showSuggestions = name.trim() !== '' && suggestions.length > 0 && !suggestionsDismissed;

  // Suchfeld-Eingabe: Name setzen und die Vorschlagsliste wieder aktivieren.
  const onSearchChange = useCallback((value) => {
    setName(value);
    setActiveIndex(-1);
    setSuggestionsDismissed(false);
  }, []);

  // Chip: sofort hinzufügen und Sheet schließen.
  const quickAdd = useCallback(
    (rawName, cat) => {
      onAdd(rawName, cat);
      onClose();
    },
    [onAdd, onClose],
  );

  // Vorschlag übernehmen: Name + Kategorie ins Formular, Liste schließen, Fokus
  // zurück ins Suchfeld (Menge lässt sich danach noch am Stepper anpassen).
  const pickSuggestion = useCallback((s) => {
    setName(s.name);
    setCategory(s.category ?? '');
    setActiveIndex(-1);
    setSuggestionsDismissed(true);
    searchRef.current?.focus();
  }, []);

  // „Hinzufügen“ fügt IMMER den eingegebenen Namen hinzu und schließt das Sheet.
  // Das Übernehmen eines hervorgehobenen Vorschlags passiert bewusst nur per
  // Enter im Suchfeld (onSearchKeyDown), damit ein Button-Klick, bei dem die
  // Maus zufällig einen Vorschlag streift, nicht ungewollt „übernehmen“ auslöst.
  const submit = useCallback(
    (e) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        searchRef.current?.focus(); // Suchfeld leer → nichts hinzuzufügen
        return;
      }

      // quantity ist über den Stepper stets eine gültige ganze Zahl ≥ 1; die
      // Standardmenge 1 wird in addItem nicht materialisiert (omit-empty).
      onAdd(trimmed, category || undefined, { quantity });
      onClose();
    },
    [name, category, quantity, onAdd, onClose],
  );

  const onSearchKeyDown = useCallback(
    (e) => {
      if (!showSuggestions) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
        // Enter auf einem hervorgehobenen Vorschlag = übernehmen (nicht abschicken).
        e.preventDefault();
        pickSuggestion(suggestions[activeIndex]);
      }
    },
    [showSuggestions, suggestions, activeIndex, pickSuggestion],
  );

  return (
    <div className="dialog dialog--top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {/* role="dialog" liegt auf dem div (auf <form> nicht erlaubt); das Formular
          umschließt den Inhalt mit display:contents ohne Layout-Einfluss. */}
      <div
        className="dialog__panel add-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        onKeyDown={onKeyDown}
      >
        <form className="dialog__form" onSubmit={submit}>
          <div className="dialog__head">
            <h2 className="dialog__title" id={titleId}>
              <Plus size={20} aria-hidden="true" />
              Artikel hinzufügen
            </h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          <div className="dialog__body">
            <div className="add-sheet__search">
              <Search size={18} aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={name}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Produkt suchen oder eingeben …"
                autoComplete="off"
                aria-label="Produkt suchen oder hinzufügen"
                aria-expanded={showSuggestions}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  showSuggestions && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
                }
                role="combobox"
              />
            </div>

            {showSuggestions ? (
              <ul className="suggestions suggestions--sheet" id={listId} role="listbox">
                {suggestions.map((s, i) => (
                  // role="presentation": unter role="listbox" sind nur option-
                  // Kinder erlaubt – die Option ist der Button selbst.
                  <li key={normalizeName(s.name)} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-option-${i}`}
                      className="suggestion"
                      data-active={i === activeIndex}
                      role="option"
                      aria-selected={i === activeIndex}
                      // Auswahl auf pointerdown: Auf Touch feuert das SOFORT beim
                      // ersten Antippen – vor Fokuswechsel und Tastatur-Layoutsprung.
                      // preventDefault hält den Fokus im Suchfeld (Tastatur bleibt
                      // offen), sodass auch der erste Vorschlag zuverlässig greift.
                      onPointerDown={(e) => {
                        e.preventDefault();
                        pickSuggestion(s);
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                    >
                      <ProductIcon name={s.name} category={s.category} className="suggestion__icon" />
                      <span className="suggestion__name">{s.name}</span>
                      {SOURCE_LABEL[s.source] && (
                        <span className="suggestion__tag">{SOURCE_LABEL[s.source]}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              frequentItems.length > 0 && (
                <FrequentChips items={frequentItems} onAdd={quickAdd} onRemove={onRemoveFromHistory} />
              )
            )}

            <div className="field-row">
              <div className="field field--qty">
                <label className="field__label" htmlFor={`${titleId}-qty`}>
                  Menge
                </label>
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  inputId={`${titleId}-qty`}
                />
              </div>
              <div className="field field--cat">
                <label className="field__label" htmlFor={`${titleId}-cat`}>
                  Kategorie
                </label>
                <select
                  id={`${titleId}-cat`}
                  className="field__input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Automatisch</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="dialog__actions">
            <button type="button" className="text-button" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="button-primary">
              Hinzufügen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default memo(AddItemSheet);
