import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TileItem from '../TileItem';

const item = { id: 'item-1', name: 'Hafermilch', category: null, checked: false, createdAt: '' };

function renderTile(overrides = {}) {
  const onToggle = vi.fn();
  const onToggleFavorite = vi.fn();
  const onRemove = vi.fn();
  const onEdit = vi.fn();
  const onSave = vi.fn();
  const onCancelEdit = vi.fn();
  const findConflict = vi.fn(() => null);
  const props = {
    item,
    isFavorite: false,
    onToggle,
    onToggleFavorite,
    onRemove,
    onEdit,
    onSave,
    onCancelEdit,
    findConflict,
    ...overrides,
  };
  render(
    <ul>
      <TileItem {...props} />
    </ul>,
  );
  return { onToggle, onToggleFavorite, onRemove, onEdit, onSave, onCancelEdit, findConflict };
}

describe('TileItem – Kachelansicht: dieselben Aktionen wie ListItem', () => {
  it('bietet Umschalten, Favorit, Bearbeiten und Löschen an – ohne verschachtelte Buttons', () => {
    renderTile();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(
      screen.getByRole('button', { name: 'Hafermilch als erledigt markieren' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hafermilch zu Favoriten hinzufügen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hafermilch bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hafermilch entfernen' })).toBeInTheDocument();
    for (const button of buttons) {
      expect(button.querySelector('button')).toBeNull();
    }
  });

  it('Favorit/Bearbeiten/Löschen sind ohne Wisch-Geste sofort sichtbar (kein data-revealed nötig)', () => {
    renderTile();
    // Anders als ListItem: die Aktionen liegen nicht hinter einer Wisch-Geste,
    // sondern sind als eigene Leiste dauerhaft sichtbar/fokussierbar.
    expect(
      screen.getByRole('button', { name: 'Hafermilch zu Favoriten hinzufügen' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hafermilch bearbeiten' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hafermilch entfernen' })).toBeVisible();
  });

  it('schaltet den Erledigt-Status um, wenn die Karte angeklickt wird', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderTile();

    await user.click(screen.getByRole('button', { name: 'Hafermilch als erledigt markieren' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('item-1');
  });

  it('spiegelt den Erledigt-Status über aria-pressed und passendes Label', () => {
    renderTile({ item: { ...item, checked: true } });

    const toggle = screen.getByRole('button', { name: 'Hafermilch als offen markieren' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('Favorit-Klick löst NICHT den Erledigt-Status oder Löschen aus', async () => {
    const user = userEvent.setup();
    const { onToggle, onToggleFavorite, onRemove } = renderTile();

    await user.click(screen.getByRole('button', { name: 'Hafermilch zu Favoriten hinzufügen' }));

    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onToggleFavorite).toHaveBeenCalledWith('Hafermilch');
    expect(onToggle).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('Löschen-Klick löst NICHT den Erledigt-Status oder Favorisieren aus', async () => {
    const user = userEvent.setup();
    const { onToggle, onToggleFavorite, onRemove } = renderTile();

    await user.click(screen.getByRole('button', { name: 'Hafermilch entfernen' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('item-1');
    expect(onToggle).not.toHaveBeenCalled();
    expect(onToggleFavorite).not.toHaveBeenCalled();
  });

  it('zeigt den Favoriten-Status über aria-pressed', () => {
    renderTile({ isFavorite: true });
    expect(
      screen.getByRole('button', { name: 'Hafermilch aus Favoriten entfernen' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('ruft onEdit mit der Artikel-id auf', async () => {
    const user = userEvent.setup();
    const { onEdit, onToggle } = renderTile();

    await user.click(screen.getByRole('button', { name: 'Hafermilch bearbeiten' }));

    expect(onEdit).toHaveBeenCalledWith('item-1');
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('TileItem – Menge', () => {
  it('zeigt ein Mengen-Präfix „2 ×“ ab einer Menge von 2', () => {
    renderTile({ item: { ...item, quantity: 2 } });
    expect(screen.getByText('2 ×')).toHaveClass('list-item__qty');
    expect(
      screen.getByRole('button', { name: '2 × Hafermilch als erledigt markieren' }),
    ).toBeInTheDocument();
  });

  it('zeigt die Standardmenge (keine gespeicherte Menge) als „1 ×“', () => {
    renderTile();
    expect(screen.getByText('1 ×')).toHaveClass('list-item__qty');
  });
});

describe('TileItem – Inline-Bearbeitung (dieselbe Komponente wie ListItem)', () => {
  it('zeigt bei isEditing das Bearbeiten-Formular statt der Karte – ohne Overlay', () => {
    renderTile({ isEditing: true });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: /bearbeiten/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /als erledigt markieren/ }),
    ).not.toBeInTheDocument();
  });

  it('speichert Änderungen inline über onSave', async () => {
    const user = userEvent.setup();
    const { onSave } = renderTile({ isEditing: true });

    await user.click(screen.getByRole('button', { name: 'Menge erhöhen' }));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'Hafermilch', quantity: 2 });
  });

  it('bricht die Inline-Bearbeitung über onCancel ab', async () => {
    const user = userEvent.setup();
    const { onCancelEdit } = renderTile({ isEditing: true });

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });
});
