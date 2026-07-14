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

  it('schließt die Vorschlagsliste nach der Auswahl (öffnet beim Weitertippen erneut)', async () => {
    const user = userEvent.setup();
    renderSheet();

    const search = screen.getByRole('combobox', { name: 'Produkt suchen oder hinzufügen' });
    await user.type(search, 'apfel');
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('option')[0]);
    // Trotz passendem Namen ist die Liste geschlossen …
    expect(search).toHaveValue('Apfel');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(search).toHaveAttribute('aria-expanded', 'false');

    // … und öffnet erst wieder, sobald der Text geändert wird.
    await user.type(search, '{Backspace}');
    expect(screen.queryByRole('listbox')).toBeInTheDocument();
  });
});

describe('AddItemSheet – Hinzufügen schließt das Sheet', () => {
  it('fügt hinzu und schließt das Sheet (Standardmenge 1)', async () => {
    const user = userEvent.setup();
    const { onAdd, onClose } = renderSheet();

    await user.type(
      screen.getByRole('combobox', { name: 'Produkt suchen oder hinzufügen' }),
      'Hafermilch',
    );
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toBe('Hafermilch');
    expect(onAdd.mock.calls[0][2]).toEqual({ quantity: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ein Chip fügt hinzu und schließt das Sheet', async () => {
    const user = userEvent.setup();
    const { onAdd, onClose } = renderSheet({
      frequentItems: [{ name: 'Bananen', category: 'obst-gemuese', count: 3 }],
    });

    // Der Chip-Add-Button trägt Name + Anzahl („Bananen×3“); der ×-Button zum
    // Entfernen heißt anders und wird so nicht getroffen.
    await user.click(screen.getByRole('button', { name: 'Bananen×3' }));

    expect(onAdd).toHaveBeenCalledWith('Bananen', 'obst-gemuese');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AddItemSheet – Mengen-Stepper', () => {
  it('startet bei 1 und erhöht die Menge über „+“', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderSheet();

    const stepper = screen.getByRole('spinbutton', { name: 'Menge' });
    expect(stepper).toHaveValue('1');

    await user.click(screen.getByRole('button', { name: 'Menge erhöhen' }));
    await user.click(screen.getByRole('button', { name: 'Menge erhöhen' }));
    expect(stepper).toHaveValue('3');

    await user.type(
      screen.getByRole('combobox', { name: 'Produkt suchen oder hinzufügen' }),
      'Tofu',
    );
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(onAdd.mock.calls[0][2]).toEqual({ quantity: 3 });
  });

  it('lässt sich nicht unter die Mindestmenge 1 verringern', () => {
    renderSheet();

    expect(screen.getByRole('button', { name: 'Menge verringern' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Menge' })).toHaveValue('1');
  });
});
