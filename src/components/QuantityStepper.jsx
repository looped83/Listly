import { memo } from 'react';
import { Minus, Plus } from 'lucide-react';

// Bedienbereich des Steppers: 1 ist die Standard-/Mindestmenge, 99 eine
// pragmatische Obergrenze (verhindert Endlos-Klicks, hält die Anzeige kompakt).
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;

/**
 * Mengen-Stepper: −/+-Buttons um eine ganze Zahl (Standard/Minimum 1). Als
 * ARIA-Spinbutton umgesetzt und zusätzlich per Pfeiltasten bedienbar; das
 * Wertfeld ist nur-lesend (die Menge ändert sich ausschließlich über die
 * Buttons/Pfeiltasten), sodass keine ungültigen Freitexteingaben entstehen.
 *
 * @param {{
 *   value: number,
 *   onChange: (next: number) => void,
 *   inputId?: string,        // für die Zuordnung eines externen <label>
 *   label?: string,          // Basis für die Button-Beschriftungen
 * }} props
 */
function QuantityStepper({ value, onChange, inputId, label = 'Menge' }) {
  const setClamped = (next) => onChange(Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, next)));

  const onKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setClamped(value + 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setClamped(value - 1);
    }
  };

  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        onClick={() => setClamped(value - 1)}
        disabled={value <= MIN_QUANTITY}
        aria-label={`${label} verringern`}
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <input
        id={inputId}
        className="stepper__value"
        type="text"
        inputMode="numeric"
        value={value}
        readOnly
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={MIN_QUANTITY}
        aria-valuemax={MAX_QUANTITY}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="stepper__btn"
        onClick={() => setClamped(value + 1)}
        disabled={value >= MAX_QUANTITY}
        aria-label={`${label} erhöhen`}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export default memo(QuantityStepper);
