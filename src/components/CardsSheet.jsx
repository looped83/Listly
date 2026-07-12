import { memo, useCallback, useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
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
      <button
        type="button"
        className="card__head"
        style={{ background: meta.color }}
        onClick={() => onToggle(card.id)}
        aria-expanded={expanded}
      >
        <span className="card__label">{card.name || meta.label}</span>
        <ChevronDown className="card__chevron" size={20} aria-hidden="true" />
      </button>

      {expanded && (
        <div className="card__codes">
          {codeType === 'barcode' ? (
            <Barcode value={content} format={barcodeFormat(content)} />
          ) : (
            <QRCode value={content} />
          )}
          {card.number && <span className="card__number">{card.number}</span>}
          <button
            type="button"
            className="text-button card__delete"
            onClick={() => onDelete(card.id)}
          >
            <Trash2 size={16} aria-hidden="true" />
            Löschen
          </button>
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
  // undefined = "Standard" (erste Karte offen); sonst explizit gewählte/keine.
  const [openId, setOpenId] = useState(undefined);

  // Swipe-nach-unten zum Schließen (oberer Bereich).
  const dragStartY = useRef(0);
  const dragging = useRef(false);
  const [dragY, setDragY] = useState(0);

  const onDragStart = useCallback((e) => {
    dragStartY.current = e.touches[0].clientY;
    dragging.current = true;
  }, []);
  const onDragMove = useCallback((e) => {
    if (!dragging.current) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStartY.current));
  }, []);
  const onDragEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setDragY((current) => {
      if (current > 100) onClose();
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

  const sorted = sortCards(cards);
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
      if (!code) return;
      const id = createId();
      setCards((prev) => [
        ...prev,
        { id, retailer: form.retailer, name: form.name.trim() || RETAILERS[form.retailer].label, code, codeType: form.codeType },
      ]);
      setOpenId(id); // neue Karte gleich aufgeklappt zeigen
      setForm(emptyForm);
      setAdding(false);
    },
    [form, setCards],
  );

  const remove = useCallback((id) => setCards((prev) => prev.filter((c) => c.id !== id)), [setCards]);

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Kundenkarten"
      onClick={closeOnBackdrop}
      style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? 'none' : 'transform 0.25s ease' }}
    >
      <div
        className="sheet__bar"
        onTouchStart={onDragStart}
        onTouchMove={onDragMove}
        onTouchEnd={onDragEnd}
      >
        <span className="sheet__grabber" aria-hidden="true" />
        <h2 className="sheet__title">Kundenkarten</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="sheet__body" onClick={closeOnBackdrop}>
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
            <div className="card-form__retailers">
              {RETAILER_ORDER.map((key) => (
                <button
                  type="button"
                  key={key}
                  className="card-form__retailer"
                  data-active={form.retailer === key}
                  onClick={() => pickRetailer(key)}
                >
                  {RETAILERS[key].label}
                </button>
              ))}
            </div>

            <input
              className="card-form__input"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Name der Karte"
              aria-label="Name der Karte"
            />
            <label className="card-form__field-label" htmlFor="card-code">
              Code-Inhalt (exakt aus der Original-App)
            </label>
            <textarea
              id="card-code"
              className="card-form__input card-form__textarea"
              value={form.code}
              onChange={(e) => update({ code: e.target.value })}
              placeholder="z. B. [redacted]"
              autoComplete="off"
              rows={2}
            />

            <div className="card-form__types">
              {[
                ['qr', 'QR-Code'],
                ['barcode', 'Barcode'],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className="card-form__type"
                  data-active={form.codeType === value}
                  onClick={() => update({ codeType: value })}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="card-form__actions">
              <button type="button" className="text-button" onClick={() => setAdding(false)}>
                Abbrechen
              </button>
              <button type="submit" className="button-primary">
                Speichern
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="button-add-card" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden="true" />
            Karte hinzufügen
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(CardsSheet);
