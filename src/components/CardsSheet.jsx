import { memo, useCallback, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
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

const emptyForm = { retailer: 'lidl', name: RETAILERS.lidl.label, number: '', code: '', codeType: 'qr' };

/** Eine Kundenkarte – zeigt den exakten Code (QR oder Barcode) und die Nummer. */
const CardView = memo(function CardView({ card, onDelete }) {
  const meta = retailerMeta(card.retailer);
  const content = cardContent(card);
  const codeType = cardCodeType(card);
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
        {codeType === 'barcode' ? (
          <Barcode value={content} format={barcodeFormat(content)} />
        ) : (
          <QRCode value={content} />
        )}
        {card.number && <span className="card__number">{card.number}</span>}
      </div>
    </li>
  );
});

/** Sheet zur Verwaltung der Kundenkarten (rein lokal gespeichert). */
function CardsSheet({ onClose }) {
  const [cards, setCards] = useLocalStorage(STORAGE_KEYS.cards, []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);

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
      const number = form.number.trim();
      const code = form.code.trim();
      if (!number && !code) return;
      setCards((prev) => [
        ...prev,
        {
          id: createId(),
          retailer: form.retailer,
          name: form.name.trim() || RETAILERS[form.retailer].label,
          number,
          code,
          codeType: form.codeType,
        },
      ]);
      setForm(emptyForm);
      setAdding(false);
    },
    [form, setCards],
  );

  const remove = useCallback((id) => setCards((prev) => prev.filter((c) => c.id !== id)), [setCards]);

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
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Name der Karte"
              aria-label="Name der Karte"
            />
            <input
              className="card-form__input"
              value={form.number}
              onChange={(e) => update({ number: e.target.value })}
              placeholder="Angezeigte Nummer (optional)"
              autoComplete="off"
              aria-label="Angezeigte Nummer"
            />
            <label className="card-form__field-label" htmlFor="card-code">
              Code-Inhalt (exakt aus der Original-App; leer = Nummer)
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
