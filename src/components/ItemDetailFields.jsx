import { memo } from 'react';
import { CATEGORY_OPTIONS } from '../lib/icons';
import QuantityStepper from './QuantityStepper';

/**
 * Detailfelder eines Artikels: Menge (Stepper) und Kategorie nebeneinander.
 * Gemeinsam genutzt vom Hinzufügen-Sheet und der Inline-Bearbeitung – gleiches
 * Layout, gleiche Bedienung; nur die Bedeutung der leeren Kategorie
 * unterscheidet sich („Automatisch“ beim Anlegen, „Keine Kategorie“ beim
 * Bearbeiten).
 *
 * @param {{
 *   idPrefix: string,                  // Basis für die Feld-IDs (Label-Zuordnung)
 *   quantity: number,
 *   onQuantityChange: (next: number) => void,
 *   category: string,                  // Kategorie-id oder '' (leer)
 *   onCategoryChange: (next: string) => void,
 *   emptyCategoryLabel: string,
 * }} props
 */
function ItemDetailFields({
  idPrefix,
  quantity,
  onQuantityChange,
  category,
  onCategoryChange,
  emptyCategoryLabel,
}) {
  return (
    <div className="field-row">
      <div className="field field--qty">
        <label className="field__label" htmlFor={`${idPrefix}-qty`}>
          Menge
        </label>
        <QuantityStepper value={quantity} onChange={onQuantityChange} inputId={`${idPrefix}-qty`} />
      </div>
      <div className="field field--cat">
        <label className="field__label" htmlFor={`${idPrefix}-cat`}>
          Kategorie
        </label>
        <select
          id={`${idPrefix}-cat`}
          className="field__input"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">{emptyCategoryLabel}</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default memo(ItemDetailFields);
