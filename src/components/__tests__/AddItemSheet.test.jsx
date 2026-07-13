import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddItemSheet from '../AddItemSheet';

function renderSheet(overrides = {}) {
  const onAdd = vi.fn();
  const onRemoveFromHistory = vi.fn();
  const onClose = vi.fn();
  const props = {
    history: {},
    favorites: [],
    existingNames: new Set(),
    frequentItems: [],
    onAdd,
    onRemoveFromHistory,
    onClose,
    ...overrides,
  };
  render(<AddItemSheet {...props} />);
  return { onAdd, onRemoveFromHistory, onClose };
}

describe('AddItemSheet – Vorschlagsauswahl', () => {
  it('übernimmt schon den ERSTEN angetippten Vorschlag zuverlässig (pointerdown)', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderSheet();

    const search = screen.getByRole('combobox', { name: 'Produkt suchen oder hinzufügen' });
    await user.type(search, 'apfel');

    // Der erste Vorschlag „Apfel" wird direkt beim Antippen übernommen.
    const options = screen.getAllByRole('option');
    await user.click(options[0]);

    // Auswahl landet im Suchfeld – nicht still verworfen, nicht sofort hinzugefügt.
    expect(search).toHaveValue('Apfel');
    expect(onAdd).not.toHaveBeenCalled();

    // Erst „Hinzufügen" fügt den ausgewählten Artikel hinzu.
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toBe('Apfel');
  });

  it('hält den Fokus beim Auswählen im Suchfeld (Tastatur bleibt offen)', async () => {
    const user = userEvent.setup();
    renderSheet();

    const search = screen.getByRole('combobox', { name: 'Produkt suchen oder hinzufügen' });
    await user.type(search, 'apfel');
    await user.click(screen.getAllByRole('option')[0]);

    expect(search).toHaveFocus();
  });
});
