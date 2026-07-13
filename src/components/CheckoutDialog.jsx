import { memo, useCallback, useId, useRef, useState } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';

/**
 * Zugänglicher Abschluss-Dialog (mobiles Bottom Sheet). Zeigt die Konsequenz
 * eines Einkaufsabschlusses und lässt bewusst zwischen „nur Abgehaktes" und
 * „alles" wählen.
 *
 * Barrierefreiheit:
 *  - role="dialog" + aria-modal, beschriftet/beschrieben über aria-labelledby/
 *    aria-describedby,
 *  - Fokusfalle (Tab/Shift+Tab zirkulieren im Dialog),
 *  - Escape schließt (= Abbrechen),
 *  - initialer Fokus auf der primären Aktion,
 *  - Rückgabe des Fokus an das auslösende Element beim Schließen.
 *
 * @param {{
 *   checkedCount: number,
 *   openCount: number,
 *   onConfirm: (includeOpen: boolean) => void,
 *   onClose: () => void,
 * }} props
 */
function CheckoutDialog({ checkedCount, openCount, onConfirm, onClose }) {
  const [includeOpen, setIncludeOpen] = useState(false);
  const confirmRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  const { panelRef, onKeyDown } = useDialogFocus({ onClose, initialFocusRef: confirmRef });

  const total = checkedCount + openCount;
  // Wenn es keine offenen Artikel gibt, ist „alles" identisch mit „nur
  // Abgehaktes" – die bewusste Zusatzwahl entfällt dann.
  const canIncludeOpen = openCount > 0;
  const willComplete = includeOpen ? total : checkedCount;

  const onBackdrop = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div className="dialog" onMouseDown={onBackdrop}>
      <div
        className="dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        ref={panelRef}
        onKeyDown={onKeyDown}
      >
        <div className="dialog__head">
          <h2 className="dialog__title" id={titleId}>
            <ShoppingBag size={20} aria-hidden="true" />
            Einkauf abschließen
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="dialog__body">
          <p className="dialog__counts">
            <span className="dialog__count">
              <strong>{checkedCount}</strong> abgehakt
            </span>
            <span className="dialog__count">
              <strong>{openCount}</strong> offen
            </span>
          </p>

          <p className="dialog__consequence" id={descId}>
            {willComplete === 1
              ? '1 Artikel wird in den Kaufverlauf verbucht und von der Liste entfernt.'
              : `${willComplete} Artikel werden in den Kaufverlauf verbucht und von der Liste entfernt.`}{' '}
            {includeOpen || openCount === 0
              ? 'Die Liste ist danach leer.'
              : openCount === 1
                ? '1 offener Artikel bleibt auf der Liste.'
                : `${openCount} offene Artikel bleiben auf der Liste.`}
          </p>

          {canIncludeOpen && (
            <label className="dialog__option">
              <input
                type="checkbox"
                checked={includeOpen}
                onChange={(e) => setIncludeOpen(e.target.checked)}
              />
              <span>
                Auch die {openCount === 1 ? 'offene Position' : `${openCount} offenen Artikel`} als
                gekauft abschließen
              </span>
            </label>
          )}
        </div>

        <div className="dialog__actions">
          <button type="button" className="text-button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="button-primary"
            ref={confirmRef}
            onClick={() => onConfirm(includeOpen)}
          >
            Einkauf abschließen
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(CheckoutDialog);
