import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { cleanName } from '../lib/history';
import { CATEGORY_OPTIONS } from '../lib/icons';
import {
  MAX_NOTE_LENGTH,
  MAX_UNIT_LENGTH,
  coerceUnit,
  coerceNote,
  formatQuantityNumber,
  parseQuantityInput,
  readItemExtras,
} from '../lib/itemFields';

/**
 * Zugänglicher Bearbeiten-Dialog (mobiles Bottom Sheet) für einen Artikel.
 * Bearbeitbar: Name, Menge, Einheit, Kategorie und Notiz.
 *
 * Barrierefreiheit über useDialogFocus (Fokusfalle, Escape, initialer Fokus,
 * Fokusrückgabe). Validierung inline mit aria-invalid/aria-describedby.
 *
 * Beim Umbenennen auf einen bereits vorhandenen Artikel wird nicht still
 * dupliziert: der Dialog fragt eine bewusste Zusammenführung ab.
 *
 * @param {{
 *   item: object,
 *   findConflict: (name: string) => object|null,
 *   onSave: (patch: object, mergeTargetId?: string) => void,
 *   onClose: () => void,
 * }} props
 */
function ItemEditDialog({ item, findConflict, onSave, onClose }) {
  const extras = readItemExtras(item);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(
    extras.quantity === null ? '' : formatQuantityNumber(extras.quantity),
  );
  const [unit, setUnit] = useState(extras.unit);
  const [note, setNote] = useState(extras.note);
  const [category, setCategory] = useState(item.category ?? '');
  const [errors, setErrors] = useState({});
  // Bei einem Namenskonflikt gemerkter Zielartikel (Zusammenführungs-Abfrage).
  const [pendingMerge, setPendingMerge] = useState(null);

  const nameRef = useRef(null);
  const mergeRef = useRef(null);
  const { panelRef, onKeyDown } = useDialogFocus({ onClose, initialFocusRef: nameRef });

  const titleId = useId();
  const nameErrId = useId();
  const qtyErrId = useId();

  // Wechselt der Dialog in die Zusammenführungs-Abfrage, Fokus auf die
  // Bestätigung legen (bleibt in der Fokusfalle).
  useEffect(() => {
    if (pendingMerge) mergeRef.current?.focus();
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
      note: coerceNote(note),
      category: category || null,
    };
  }, [name, quantity, unit, note, category]);

  const submit = useCallback(
    (e) => {
      e.preventDefault();
      const patch = validate();
      if (!patch) return;

      // Konflikt nur, wenn der (neue) Name zu einem ANDEREN Artikel passt.
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
    <div className="dialog" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        onKeyDown={onKeyDown}
        onSubmit={submit}
      >
        <div className="dialog__head">
          <h2 className="dialog__title" id={titleId}>
            <Pencil size={18} aria-hidden="true" />
            Artikel bearbeiten
          </h2>
        </div>

        {pendingMerge ? (
          <>
            <div className="dialog__body">
              <p className="dialog__consequence">
                „{pendingMerge.name}“ steht bereits auf der Liste. Beim Speichern werden beide zu
                einem Artikel zusammengeführt – die hier eingegebenen Werte gelten.
              </p>
            </div>
            <div className="dialog__actions">
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
            <div className="dialog__body">
              <div className="field">
                <label className="field__label" htmlFor={`${titleId}-name`}>
                  Name
                </label>
                <input
                  id={`${titleId}-name`}
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
                  <option value="">Keine Kategorie</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field__label" htmlFor={`${titleId}-note`}>
                  Notiz
                </label>
                <textarea
                  id={`${titleId}-note`}
                  className="field__input field__textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={MAX_NOTE_LENGTH}
                  rows={2}
                  placeholder="z. B. ungesüßt"
                />
              </div>
            </div>

            <div className="dialog__actions">
              <button type="button" className="text-button" onClick={onClose}>
                Abbrechen
              </button>
              <button type="submit" className="button-primary">
                Speichern
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export default memo(ItemEditDialog);
