import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { STORAGE_KEYS } from '../lib/storage';
import {
  RETAILERS,
  RETAILER_ORDER,
  barcodeFormat,
  cardCodeType,
  cardContent,
  retailerMeta,
  sortCards,
} from '../lib/cards';
import { QRCode, Barcode } from './CodeImage';

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyForm = { retailer: 'lidl', name: RETAILERS.lidl.label, code: '', codeType: 'qr' };

/** Eine Kundenkarte als aufklappbares Akkordeon-Element. */
const CardView = memo(function CardView({ card, expanded, onToggle, onDelete }) {
  const meta = retailerMeta(card.retailer);
  const content = cardContent(card);
  const codeType = cardCodeType(card);
  return (
    <li className="card" data-expanded={expanded}>
      <div className="card__head" style={{ background: meta.color }}>
        <button
          type="button"
          className="card__toggle"
          onClick={() => onToggle(card.id)}
          aria-expanded={expanded}
        >
          <span className="card__label">{card.name || meta.label}</span>
          <ChevronDown className="card__chevron" size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="card__delete"
          onClick={() => onDelete(card.id)}
          aria-label={`${card.name || meta.label} löschen`}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div className="card__codes">
          {codeType === 'barcode' ? (
            <Barcode value={content} format={barcodeFormat(content)} />
          ) : (
            <QRCode value={content} size={264} />
          )}
          {card.number && <span className="card__number">{card.number}</span>}
        </div>
      )}
    </li>
  );
});

/** Sheet zur Verwaltung der Kundenkarten (rein lokal gespeichert). */
function CardsSheet({ onClose }) {
  const [cards, setCards] = useLocalStorage(STORAGE_KEYS.cards, []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [codeError, setCodeError] = useState('');
  // undefined = "Standard" (erste Karte offen); sonst explizit gewählte/keine.
  const [openId, setOpenId] = useState(undefined);

  // Modaler Dialog: Fokusfalle, Escape schließt, Fokusrückgabe an den
  // Wallet-Button beim Schließen (gleiche Infrastruktur wie die anderen Sheets).
  const closeButtonRef = useRef(null);
  const { panelRef, onKeyDown } = useDialogFocus({ onClose, initialFocusRef: closeButtonRef });
  const nameFieldId = useId();
  const codeFieldId = useId();
  const codeErrorId = useId();
  const codeRef = useRef(null);
  const nameRef = useRef(null);
  const addButtonRef = useRef(null);

  // Beim Umschalten Formular ⇄ Button verschwindet das fokussierte Element –
  // den Fokus explizit nachführen, damit die Tastaturposition erhalten bleibt.
  const prevAdding = useRef(adding);
  useEffect(() => {
    if (adding === prevAdding.current) return;
    prevAdding.current = adding;
    if (adding) nameRef.current?.focus();
    else addButtonRef.current?.focus();
  }, [adding]);

  // Swipe-nach-unten zum Schließen: wirksam, wenn die Geste in der Leiste
  // beginnt oder der scrollbare Bereich bereits ganz oben steht.
  const bodyRef = useRef(null);
  const dragStartY = useRef(0);
  const dragging = useRef(false);
  const canDismiss = useRef(false);
  const [dragY, setDragY] = useState(0);

  const onDragStart = useCallback((e) => {
    const inBar = Boolean(e.target.closest?.('.sheet__bar'));
    const atTop = (bodyRef.current?.scrollTop ?? 0) <= 0;
    canDismiss.current = inBar || atTop;
    dragStartY.current = e.touches[0].clientY;
    dragging.current = true;
  }, []);
  const onDragMove = useCallback((e) => {
    if (!dragging.current || !canDismiss.current) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStartY.current));
  }, []);
  const onDragEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setDragY((current) => {
      if (current > 90) onClose();
      return 0;
    });
  }, [onClose]);

  // Klick auf leere (schwarze) Fläche schließt das Overlay.
  const closeOnBackdrop = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // Memoisiert: vermeidet ein Neu-Sortieren pro Render und hält `toggle` stabil,
  // damit die memoisierten CardView-Einträge nicht unnötig neu rendern.
  const sorted = useMemo(() => sortCards(cards), [cards]);
  const effectiveOpenId = openId === undefined ? sorted[0]?.id : openId;

  const toggle = useCallback(
    (id) => setOpenId((prev) => ((prev === undefined ? sorted[0]?.id : prev) === id ? null : id)),
    [sorted],
  );

  const update = useCallback((patch) => setForm((prev) => ({ ...prev, ...patch })), []);

  const pickRetailer = useCallback((retailer) => {
    setForm((prev) => ({
      ...prev,
      retailer,
      name: RETAILERS[retailer].label,
      codeType: RETAILERS[retailer].codeType,
    }));
  }, []);

  const save = useCallback(
    (e) => {
      e.preventDefault();
      const code = form.code.trim();
      if (!code) {
        setCodeError('Bitte den Code-Inhalt einfügen.');
        codeRef.current?.focus();
        return;
      }
      const id = createId();
      setCards((prev) => [
        ...prev,
        { id, retailer: form.retailer, name: form.name.trim() || RETAILERS[form.retailer].label, code, codeType: form.codeType },
      ]);
      setOpenId(id); // neue Karte gleich aufgeklappt zeigen
      setForm(emptyForm);
      setCodeError('');
      setAdding(false);
    },
    [form, setCards],
  );

  const cancelAdding = useCallback(() => {
    setCodeError('');
    setAdding(false);
  }, []);

  const remove = useCallback((id) => setCards((prev) => prev.filter((c) => c.id !== id)), [setCards]);

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Kundenkarten"
      ref={panelRef}
      onKeyDown={onKeyDown}
      onClick={closeOnBackdrop}
      onTouchStart={onDragStart}
      onTouchMove={onDragMove}
      onTouchEnd={onDragEnd}
      style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? 'none' : 'transform 0.25s ease' }}
    >
      <div className="sheet__bar">
        <span className="sheet__grabber" aria-hidden="true" />
        <h2 className="sheet__title">Kundenkarten</h2>
        <button
          type="button"
          className="icon-button"
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Schließen"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="sheet__body" ref={bodyRef} onClick={closeOnBackdrop}>
        {cards.length === 0 && !adding && (
          <p className="sheet__hint">
            Noch keine Karte hinterlegt. Füge deine Karten hinzu – sie werden nur lokal auf diesem
            Gerät gespeichert.
          </p>
        )}

        <ul className="cards">
          {sorted.map((card) => (
            <CardView
              key={card.id}
              card={card}
              expanded={card.id === effectiveOpenId}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </ul>

        {adding ? (
          <form className="card-form" onSubmit={save}>
            <div className="card-form__retailers" role="group" aria-label="Händler wählen">
              {RETAILER_ORDER.map((key) => (
                <button
                  type="button"
                  key={key}
                  className="card-form__retailer"
                  data-active={form.retailer === key}
                  aria-pressed={form.retailer === key}
                  onClick={() => pickRetailer(key)}
                >
                  {RETAILERS[key].label}
                </button>
              ))}
            </div>

            <label className="card-form__field-label" htmlFor={nameFieldId}>
              Name der Karte
            </label>
            <input
              id={nameFieldId}
              ref={nameRef}
              className="card-form__input"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              autoComplete="off"
            />
            <label className="card-form__field-label" htmlFor={codeFieldId}>
              Code-Inhalt (exakt aus der Original-App)
            </label>
            <textarea
              id={codeFieldId}
              ref={codeRef}
              className="card-form__input card-form__textarea"
              value={form.code}
              onChange={(e) => {
                update({ code: e.target.value });
                if (codeError) setCodeError('');
              }}
              placeholder="Code-Inhalt einfügen"
              autoComplete="off"
              rows={2}
              aria-required="true"
              aria-invalid={codeError ? 'true' : undefined}
              aria-describedby={codeError ? codeErrorId : undefined}
            />
            {codeError && (
              <p className="field__error" id={codeErrorId}>
                {codeError}
              </p>
            )}

            <div className="card-form__types" role="group" aria-label="Code-Typ wählen">
              {[
                ['qr', 'QR-Code'],
                ['barcode', 'Barcode'],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className="card-form__type"
                  data-active={form.codeType === value}
                  aria-pressed={form.codeType === value}
                  onClick={() => update({ codeType: value })}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="card-form__actions">
              <button type="button" className="text-button" onClick={cancelAdding}>
                Abbrechen
              </button>
              <button type="submit" className="button-primary">
                Speichern
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="button-add-card"
            ref={addButtonRef}
            onClick={() => setAdding(true)}
          >
            <Plus size={18} aria-hidden="true" />
            Karte hinzufügen
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(CardsSheet);
