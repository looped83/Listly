import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { cleanName } from '../lib/history';
import { CATEGORY_OPTIONS } from '../lib/icons';
import { coerceQuantity, readItemExtras } from '../lib/itemFields';
import QuantityStepper, { MIN_QUANTITY } from './QuantityStepper';

/**
 * Bearbeiten eines Artikels DIREKT in der aufgeklappten Kachel – kein Overlay.
 * Bearbeitbar: Name, Menge und Kategorie.
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
  // Stepper-Wert: die gespeicherte Menge (≥ 2) oder die Standardmenge 1.
  const [quantity, setQuantity] = useState(extras.quantity ?? MIN_QUANTITY);
  const [category, setCategory] = useState(item.category ?? '');
  const [errors, setErrors] = useState({});
  const [pendingMerge, setPendingMerge] = useState(null);

  const nameRef = useRef(null);
  const mergeRef = useRef(null);

  const baseId = useId();
  const nameErrId = `${baseId}-name-err`;

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
    const cleanedName = cleanName(name);
    if (!cleanedName) {
      setErrors({ name: 'Bitte einen Namen eingeben.' });
      return null;
    }
    setErrors({});

    // quantity ist über den Stepper stets gültig; coerceQuantity gibt die
    // Standardmenge 1 als null zurück (löscht ein vorhandenes Mengenfeld).
    return {
      name: cleanedName,
      quantity: coerceQuantity(quantity),
      category: category || null,
    };
  }, [name, quantity, category]);

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
              <QuantityStepper value={quantity} onChange={setQuantity} inputId={`${baseId}-qty`} />
            </div>
            <div className="field field--cat">
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
