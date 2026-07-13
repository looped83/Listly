import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ItemEditDialog from '../ItemEditDialog';

const baseItem = { id: 'i1', name: 'Hafermilch', category: null, checked: false };

function setup(overrides = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const findConflict =
    overrides.findConflict ??
    ((name) => (name.trim().toLowerCase() === 'birne' ? { id: 't1', name: 'Birne' } : null));
  render(
    <ItemEditDialog
      item={overrides.item ?? baseItem}
      findConflict={findConflict}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
}

describe('ItemEditDialog – Zugänglichkeit & Validierung', () => {
  it('legt den initialen Fokus auf das Namensfeld', () => {
    setup();
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('schließt bei Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('verweigert das Speichern bei leerem Namen und zeigt einen Fehler', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(screen.getByText('Bitte einen Namen eingeben.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('verweigert das Speichern bei nicht positiver/ungültiger Menge', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.type(screen.getByLabelText('Menge'), '0');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(screen.getByText('Bitte eine positive Zahl eingeben.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('speichert normalisierte Werte (Komma-Menge, getrimmte Einheit/Notiz, Kategorie)', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.type(screen.getByLabelText('Menge'), '0,5');
    await user.type(screen.getByLabelText('Einheit'), '  l  ');
    await user.type(screen.getByLabelText('Notiz'), '  ungesüßt  ');
    await user.selectOptions(screen.getByLabelText('Kategorie'), 'milchalternativen');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      name: 'Hafermilch',
      quantity: 0.5,
      unit: 'l',
      note: 'ungesüßt',
      category: 'milchalternativen',
    });
  });

  it('kapitalisiert den Namen wie beim Hinzufügen', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'tofu');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tofu' }));
  });
});

describe('ItemEditDialog – Umbenennen auf vorhandenen Artikel', () => {
  it('bietet statt stiller Dublette eine bewusste Zusammenführung an', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Birne');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    // Kein stiller Save – erst die Zusammenführungs-Abfrage.
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/steht bereits auf der Liste/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zusammenführen' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Birne' }), 't1');
  });

  it('kehrt aus der Zusammenführungs-Abfrage per „Zurück" zum Formular zurück', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Birne');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    await user.click(screen.getByRole('button', { name: 'Zurück' }));

    // Formular wieder da, nichts gespeichert.
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
