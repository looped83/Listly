import { memo, useCallback, useId, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { buildSuggestions } from '../lib/suggestions';
import { normalizeName } from '../lib/history';
import { CATEGORY_OPTIONS } from '../lib/icons';
import { MAX_UNIT_LENGTH, coerceUnit, parseQuantityInput } from '../lib/itemFields';
import { useDialogFocus } from '../hooks/useDialogFocus';
import FrequentChips from './FrequentChips';
import ProductIcon from './ProductIcon';

const SOURCE_LABEL = { history: 'Verlauf', favorite: 'Favorit' };

/**
 * Bottom-Sheet zum Hinzufügen eines Artikels: Produktsuche mit
 * Autovervollständigung, Häufig-gekauft-Chips und den Detailfeldern
 * (Menge, Einheit, Kategorie) in einem Schritt.
 *
 * Interaktionsmodell:
 *  - Chip antippen  → sofort hinzufügen (schneller Mehrfach-Zugriff), Sheet bleibt offen.
 *  - Vorschlag wählen → Name (+ Kategorie) ins Formular übernehmen, um Details zu ergänzen.
 *  - „Hinzufügen“  → Name + Details übernehmen und Sheet schließen.
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
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');
  const [errors, setErrors] = useState({});

  const searchRef = useRef(null);
  const { panelRef, onKeyDown } = useDialogFocus({ onClose, initialFocusRef: searchRef });

  const titleId = useId();
  const listId = useId();
  const qtyErrId = useId();

  const suggestions = useMemo(
    () => buildSuggestions(name, { history, favorites, excludeNames: existingNames }),
    [name, history, favorites, existingNames],
  );
  const showSuggestions = name.trim() !== '' && suggestions.length > 0;

  const resetForm = useCallback(() => {
    setName('');
    setQuantity('');
    setUnit('');
    setCategory('');
    setActiveIndex(-1);
    setErrors({});
  }, []);

  // Chip: sofort hinzufügen, Sheet offen lassen (schnelle Folge-Adds).
  const quickAdd = useCallback(
    (rawName, cat) => {
      onAdd(rawName, cat);
      resetForm();
      searchRef.current?.focus();
    },
    [onAdd, resetForm],
  );

  // Vorschlag: Name + Kategorie übernehmen, damit Details ergänzt werden können.
  const pickSuggestion = useCallback((s) => {
    setName(s.name);
    setCategory(s.category ?? '');
    setActiveIndex(-1);
    searchRef.current?.focus();
  }, []);

  const submit = useCallback(
    (e) => {
      e.preventDefault();
      // Enter auf einem hervorgehobenen Vorschlag = übernehmen (nicht abschicken).
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        pickSuggestion(suggestions[activeIndex]);
        return;
      }

      const trimmed = name.trim();
      const parsed = parseQuantityInput(quantity);
      const nextErrors = {};
      if (!trimmed) nextErrors.name = true; // Suchfeld leer → nichts hinzuzufügen
      if (!parsed.ok) nextErrors.quantity = 'Bitte eine positive Zahl eingeben.';
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        if (nextErrors.name) searchRef.current?.focus();
        return;
      }

      onAdd(trimmed, category || undefined, {
        quantity: parsed.value,
        unit: coerceUnit(unit),
      });
      // Sheet offen lassen für schnelle Folge-Adds; Felder leeren, Suche fokussieren.
      resetForm();
      searchRef.current?.focus();
    },
    [activeIndex, suggestions, pickSuggestion, name, quantity, category, unit, onAdd, resetForm],
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
      }
    },
    [showSuggestions, suggestions.length],
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
                onChange={(e) => {
                  setName(e.target.value);
                  setActiveIndex(-1);
                }}
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
                <input
                  id={`${titleId}-qty`}
                  className="field__input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="z. B. 2"
                  aria-invalid={errors.quantity ? 'true' : undefined}
                  aria-describedby={errors.quantity ? qtyErrId : undefined}
                />
              </div>
              <div className="field field--unit">
                <label className="field__label" htmlFor={`${titleId}-unit`}>
                  Einheit
                </label>
                <input
                  id={`${titleId}-unit`}
                  className="field__input"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  maxLength={MAX_UNIT_LENGTH}
                  autoComplete="off"
                  placeholder="z. B. g, Dose"
                />
              </div>
            </div>
            {errors.quantity && (
              <p className="field__error" id={qtyErrId}>
                {errors.quantity}
              </p>
            )}

            <div className="field">
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
