import { Pencil, Star, X } from 'lucide-react';

// Aktions-Buttons eines Artikels (Favorit / Bearbeiten / Löschen) – gemeinsam
// genutzt von der Listen- (Wisch-Leiste) und der Kachelansicht (Aktionen-
// Panel). Die Anordnung übernimmt der jeweilige Aufrufer; hier liegen Optik,
// Icon und die Screenreader-Beschriftung an EINER Stelle.

/** Favorit umschalten (Stern, gefüllt = aktiv). */
export function FavoriteButton({ name, isFavorite, onToggle, iconSize, className = '' }) {
  return (
    <button
      type="button"
      className={`icon-button icon-button--fav ${className}`.trim()}
      data-active={isFavorite}
      onClick={() => onToggle(name)}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `${name} aus Favoriten entfernen` : `${name} zu Favoriten hinzufügen`}
    >
      <Star size={iconSize} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}

/** Artikel bearbeiten; `descriptor` = sprechende Bezeichnung inkl. Menge. */
export function EditButton({ descriptor, onClick, iconSize }) {
  return (
    <button type="button" className="icon-button" onClick={onClick} aria-label={`${descriptor} bearbeiten`}>
      <Pencil size={iconSize} aria-hidden="true" />
    </button>
  );
}

/** Artikel entfernen; `descriptor` = sprechende Bezeichnung inkl. Menge. */
export function RemoveButton({ descriptor, onClick, iconSize }) {
  return (
    <button
      type="button"
      className="icon-button icon-button--danger"
      onClick={onClick}
      aria-label={`${descriptor} entfernen`}
    >
      <X size={iconSize} aria-hidden="true" />
    </button>
  );
}
