import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListItem from '../ListItem';

const item = { id: 'item-1', name: 'Hafermilch', category: null, checked: false, createdAt: '' };

function renderItem(overrides = {}) {
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
      <ListItem {...props} />
    </ul>,
  );
  return { onToggle, onToggleFavorite, onRemove, onEdit, onSave, onCancelEdit, findConflict };
}

describe('ListItem – Semantik & Trefferflächen', () => {
  it('bietet Umschalten sowie Favorit/Bearbeiten/Löschen ohne „Mehr“-Menü und ohne verschachtelte Buttons', () => {
    renderItem();

    // Kein „Mehr“-Menü mehr (die Aktionen warten hinter dem Swipe).
    expect(
      screen.queryByRole('button', { name: /Weitere Aktionen/ }),
    ).not.toBeInTheDocument();

    // Umschalten + Favorit + Bearbeiten + Löschen – alle vier direkt erreichbar.
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

describe('ListItem – Menge', () => {
  it('zeigt ein Mengen-Präfix „2 ×“ ab einer Menge von 2', () => {
    renderItem({ item: { ...item, quantity: 2 } });
    expect(screen.getByText('2 ×')).toHaveClass('list-item__qty');
    // Umschalt-Label nennt die Menge mit.
    expect(
      screen.getByRole('button', { name: '2 × Hafermilch als erledigt markieren' }),
    ).toBeInTheDocument();
  });

  it('zeigt größere Mengen als „12 ×“', () => {
    renderItem({ item: { ...item, quantity: 12 } });
    expect(screen.getByText('12 ×')).toHaveClass('list-item__qty');
  });

  it('zeigt die Standardmenge (keine gespeicherte Menge) als „1 ×“', () => {
    renderItem();
    expect(screen.getByText('1 ×')).toHaveClass('list-item__qty');
    // Das aria-Label bleibt ohne „1 ×“ (die Standardmenge bleibt dort implizit).
    expect(
      screen.getByRole('button', { name: 'Hafermilch als erledigt markieren' }),
    ).toBeInTheDocument();
  });

  it('ruft onEdit mit der Artikel-id auf', async () => {
    const user = userEvent.setup();
    const { onEdit, onToggle } = renderItem();

    await user.click(screen.getByRole('button', { name: 'Hafermilch bearbeiten' }));

    expect(onEdit).toHaveBeenCalledWith('item-1');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('deckt die Aktionsleiste auf, sobald eine Aktion den Fokus erhält (Bedienung ohne Geste)', async () => {
    const user = userEvent.setup();
    renderItem();
    const row = document.querySelector('.list-item');
    expect(row).toHaveAttribute('data-revealed', 'false');

    // Erstes Tab landet auf der ersten Aktion (Favorit) → Leiste klappt auf.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Hafermilch zu Favoriten hinzufügen' })).toHaveFocus();
    expect(row).toHaveAttribute('data-revealed', 'true');
  });
});

describe('ListItem – Inline-Bearbeitung (aufgeklappte Kachel)', () => {
  it('zeigt bei isEditing das Bearbeiten-Formular statt der Zeile – ohne Overlay', () => {
    renderItem({ isEditing: true });

    // Kein Dialog/Overlay: das Formular ist inline Teil der Kachel.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: /bearbeiten/ })).toBeInTheDocument();
    // Der Umschalt-Button der Zeile ist während der Bearbeitung nicht sichtbar.
    expect(
      screen.queryByRole('button', { name: /als erledigt markieren/ }),
    ).not.toBeInTheDocument();
  });

  it('speichert Änderungen inline über onSave', async () => {
    const user = userEvent.setup();
    const { onSave } = renderItem({ isEditing: true });

    // Menge über den Stepper auf 3 (zweimal „+“ ab 1).
    await user.click(screen.getByRole('button', { name: 'Menge erhöhen' }));
    await user.click(screen.getByRole('button', { name: 'Menge erhöhen' }));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'Hafermilch', quantity: 3 });
  });

  it('bricht die Inline-Bearbeitung über onCancel ab', async () => {
    const user = userEvent.setup();
    const { onCancelEdit } = renderItem({ isEditing: true });

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });
});
