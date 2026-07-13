import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListItem from '../ListItem';

const item = { id: 'item-1', name: 'Hafermilch', category: null, checked: false, createdAt: '' };

function renderItem(overrides = {}) {
  const onToggle = vi.fn();
  const onToggleFavorite = vi.fn();
  const onRemove = vi.fn();
  const props = {
    item,
    isFavorite: false,
    onToggle,
    onToggleFavorite,
    onRemove,
    ...overrides,
  };
  render(
    <ul>
      <ListItem {...props} />
    </ul>,
  );
  return { onToggle, onToggleFavorite, onRemove };
}

describe('ListItem – Semantik & Trefferflächen', () => {
  it('rendert genau drei sibling-Buttons ohne verschachtelte Buttons', () => {
    renderItem();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    // Kein <button> enthält ein weiteres <button> als Nachfahre (ungültiges HTML).
    for (const button of buttons) {
      expect(button.querySelector('button')).toBeNull();
    }
  });

  it('schaltet den Erledigt-Status um, wenn der Hauptbereich (Icon + Name) angeklickt wird', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Hafermilch als erledigt markieren' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('item-1');
  });

  it('ist per Tastatur bedienbar (Fokus + Enter schaltet um)', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderItem();

    const toggle = screen.getByRole('button', { name: 'Hafermilch als erledigt markieren' });
    toggle.focus();
    expect(toggle).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('spiegelt den Erledigt-Status über aria-pressed und passendes Label', () => {
    renderItem({ item: { ...item, checked: true } });

    const toggle = screen.getByRole('button', { name: 'Hafermilch als offen markieren' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('Favorit-Klick löst NICHT den Erledigt-Status oder Löschen aus', async () => {
    const user = userEvent.setup();
    const { onToggle, onToggleFavorite, onRemove } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Hafermilch zu Favoriten hinzufügen' }));

    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onToggleFavorite).toHaveBeenCalledWith('Hafermilch');
    expect(onToggle).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('Löschen-Klick löst NICHT den Erledigt-Status oder Favorisieren aus', async () => {
    const user = userEvent.setup();
    const { onToggle, onToggleFavorite, onRemove } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Hafermilch entfernen' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('item-1');
    expect(onToggle).not.toHaveBeenCalled();
    expect(onToggleFavorite).not.toHaveBeenCalled();
  });

  it('zeigt den Favoriten-Status über aria-pressed und ein präzises Label', () => {
    renderItem({ isFavorite: true });

    const fav = screen.getByRole('button', { name: 'Hafermilch aus Favoriten entfernen' });
    expect(fav).toHaveAttribute('aria-pressed', 'true');
  });

  it('kürzt lange Artikelnamen visuell (Ellipsis-Klasse), ohne den Namen aus der Zeile zu entfernen', () => {
    const longName = 'Bio-Vollkorn-Dinkelspaghetti aus nachhaltigem Anbau ohne Zusatzstoffe';
    renderItem({ item: { ...item, name: longName } });

    const nameEl = screen.getByText(longName);
    expect(nameEl).toHaveClass('list-item__name');
  });
});
