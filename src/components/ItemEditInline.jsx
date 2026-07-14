import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { cleanName } from '../lib/history';
import { CATEGORY_OPTIONS } from '../lib/icons';
import {
  MAX_UNIT_LENGTH,
  coerceUnit,
  formatQuantityNumber,
  parseQuantityInput,
  readItemExtras,
} from '../lib/itemFields';

/**
 * Bearbeiten eines Artikels DIREKT in der aufgeklappten Kachel – kein Overlay.
 * Bearbeitbar: Name, Menge, Einheit und Kategorie.
 *
 * Der Fokus wird beim Aufklappen auf das Namensfeld gelegt. Die Kachel bleibt
 * Teil der Seite (nicht modal), daher keine Fokusfalle – Escape bricht ab.
 *
 * Beim Umbenennen auf einen bereits vorhandenen Artikel wird nicht still
 * dupliziert: es erscheint eine bewusste Zusammenführungs-Abfrage.
 *
 * @param {{
 *   item: object,
 *   findConflict: (name: string) => object|null,
 *   onSave: (patch: object, mergeTargetId?: string) => void,
 *   onCancel: () => void,
 * }} props
 */
function ItemEditInline({ item, findConflict, onSave, onCancel }) {
  const extras = readItemExtras(item);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(
    extras.quantity === null ? '' : formatQuantityNumber(extras.quantity),
  );
  const [unit, setUnit] = useState(extras.unit);
  const [category, setCategory] = useState(item.category ?? '');
  const [errors, setErrors] = useState({});
  const [pendingMerge, setPendingMerge] = useState(null);

  const nameRef = useRef(null);
  const mergeRef = useRef(null);

  const baseId = useId();
  const nameErrId = `${baseId}-name-err`;
  const qtyErrId = `${baseId}-qty-err`;

  // Namensfeld beim Aufklappen fokussieren.
  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  // Fokus folgt der Ansicht: in der Zusammenführungs-Abfrage auf „Zusammenführen“,
  // nach „Zurück“ wieder auf das Namensfeld (der Zurück-Button verschwindet –
  // ohne Nachführen fiele der Fokus auf body und Escape griffe nicht mehr).
  useEffect(() => {
    if (pendingMerge) mergeRef.current?.focus();
    else nameRef.current?.focus();
  }, [pendingMerge]);

  const validate = useCallback(() => {
    const nextErrors = {};
    const cleanedName = cleanName(name);
    if (!cleanedName) nextErrors.name = 'Bitte einen Namen eingeben.';

    const parsed = parseQuantityInput(quantity);
    if (!parsed.ok) nextErrors.quantity = 'Bitte eine positive Zahl eingeben.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    return {
      name: cleanedName,
      quantity: parsed.value,
      unit: coerceUnit(unit),
      category: category || null,
    };
  }, [name, quantity, unit, category]);

  const submit = useCallback(
    (e) => {
      e.preventDefault();
      const patch = validate();
      if (!patch) return;

      const conflict = findConflict(patch.name);
      if (conflict) {
        setPendingMerge(conflict);
        return;
      }
      onSave(patch);
    },
    [validate, findConflict, onSave],
  );

  const confirmMerge = useCallback(() => {
    const patch = validate();
    if (!patch || !pendingMerge) return;
    onSave(patch, pendingMerge.id);
  }, [validate, pendingMerge, onSave]);

  return (
    <form
      className="item-edit"
      aria-label={`„${item.name}“ bearbeiten`}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      {pendingMerge ? (
        <>
          <p className="item-edit__consequence">
            „{pendingMerge.name}“ steht bereits auf der Liste. Beim Speichern werden beide zu einem
            Artikel zusammengeführt – die hier eingegebenen Werte gelten.
          </p>
          <div className="item-edit__actions">
            <button type="button" className="text-button" onClick={() => setPendingMerge(null)}>
              Zurück
            </button>
            <button type="button" className="button-primary" ref={mergeRef} onClick={confirmMerge}>
              Zusammenführen
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label className="field__label" htmlFor={`${baseId}-name`}>
              Name
            </label>
            <input
              id={`${baseId}-name`}
              ref={nameRef}
              className="field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              aria-required="true"
              aria-invalid={errors.name ? 'true' : undefined}
              aria-describedby={errors.name ? nameErrId : undefined}
            />
            {errors.name && (
              <p className="field__error" id={nameErrId}>
                {errors.name}
              </p>
            )}
          </div>

          <div className="field-row">
            <div className="field field--qty">
              <label className="field__label" htmlFor={`${baseId}-qty`}>
                Menge
              </label>
              <input
                id={`${baseId}-qty`}
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
              <label className="field__label" htmlFor={`${baseId}-unit`}>
                Einheit
              </label>
              <input
                id={`${baseId}-unit`}
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
            <label className="field__label" htmlFor={`${baseId}-cat`}>
              Kategorie
            </label>
            <select
              id={`${baseId}-cat`}
              className="field__input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Keine Kategorie</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="item-edit__actions">
            <button type="button" className="text-button" onClick={onCancel}>
              Abbrechen
            </button>
            <button type="submit" className="button-primary">
              Speichern
            </button>
          </div>
        </>
      )}
    </form>
  );
}

export default memo(ItemEditInline);
