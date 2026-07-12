import { memo, useCallback, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../lib/storage';
import {
  RETAILERS,
  RETAILER_ORDER,
  barcodeFormat,
  cleanNumber,
  retailerMeta,
  sortCards,
} from '../lib/cards';
import { QRCode, Barcode } from './CodeImage';

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyForm = { retailer: 'lidl', name: RETAILERS.lidl.label, number: '' };

/** Eine einzelne Kundenkarte mit QR-Code und Barcode. */
const CardView = memo(function CardView({ card, onDelete }) {
  const meta = retailerMeta(card.retailer);
  const number = cleanNumber(card.number);
  return (
    <li className="card">
      <div className="card__head" style={{ background: meta.color }}>
        <span className="card__label">{card.name || meta.label}</span>
        <button
          type="button"
          className="card__delete"
          onClick={() => onDelete(card.id)}
          aria-label={`${card.name || meta.label} löschen`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="card__codes">
        <QRCode value={number} />
        <Barcode value={number} format={barcodeFormat(number)} />
        <span className="card__number">{card.number}</span>
      </div>
    </li>
  );
});

/** Sheet zur Verwaltung der Kundenkarten (rein lokal gespeichert). */
function CardsSheet({ onClose }) {
  const [cards, setCards] = useLocalStorage(STORAGE_KEYS.cards, []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const pickRetailer = useCallback((retailer) => {
    setForm((prev) => ({ ...prev, retailer, name: RETAILERS[retailer].label }));
  }, []);

  const save = useCallback(
    (e) => {
      e.preventDefault();
      const number = cleanNumber(form.number);
      if (!number) return;
      setCards((prev) => [
        ...prev,
        { id: createId(), retailer: form.retailer, name: form.name.trim() || RETAILERS[form.retailer].label, number },
      ]);
      setForm(emptyForm);
      setAdding(false);
    },
    [form, setCards],
  );

  const remove = useCallback(
    (id) => setCards((prev) => prev.filter((c) => c.id !== id)),
    [setCards],
  );

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Kundenkarten">
      <div className="sheet__bar">
        <h2 className="sheet__title">Kundenkarten</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="sheet__body">
        {cards.length === 0 && !adding && (
          <p className="sheet__hint">
            Noch keine Karte hinterlegt. Füge deine Karten hinzu – sie werden nur lokal auf diesem
            Gerät gespeichert.
          </p>
        )}

        <ul className="cards">
          {sortCards(cards).map((card) => (
            <CardView key={card.id} card={card} onDelete={remove} />
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
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Name der Karte"
              aria-label="Name der Karte"
            />
            <input
              className="card-form__input"
              value={form.number}
              onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
              placeholder="Kartennummer"
              inputMode="numeric"
              autoComplete="off"
              aria-label="Kartennummer"
            />
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
