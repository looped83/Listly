import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

const toggleButton = () => screen.getByRole('button', { name: 'Hafermilch als erledigt markieren' });

describe('TileItem – kompakte Kachel (Standardzustand)', () => {
  it('zeigt standardmäßig nur den Umschalt-Button – Favorit/Bearbeiten/Löschen sind nicht sichtbar', () => {
    renderTile();

    expect(toggleButton()).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Hafermilch zu Favoriten hinzufügen' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hafermilch bearbeiten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hafermilch entfernen' })).not.toBeInTheDocument();
    // Nur ein Button (der Umschalter) im Standardzustand.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('schaltet den Erledigt-Status um, wenn die Karte angeklickt wird', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderTile();

    await user.click(toggleButton());

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('item-1');
  });

  it('spiegelt den Erledigt-Status über aria-pressed und passendes Label', () => {
    renderTile({ item: { ...item, checked: true } });
    expect(
      screen.getByRole('button', { name: 'Hafermilch als offen markieren' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('zeigt ein Mengen-Präfix „2 ×“ ab einer Menge von 2', () => {
    renderTile({ item: { ...item, quantity: 2 } });
    expect(screen.getByText('2 ×')).toHaveClass('list-item__qty');
  });

  it('zeigt die Standardmenge (keine gespeicherte Menge) als „1 ×“', () => {
    renderTile();
    expect(screen.getByText('1 ×')).toHaveClass('list-item__qty');
  });

  it('nennt Screenreadern per aria-describedby, wie sich die Aktionen öffnen lassen', () => {
    renderTile();
    const hintId = toggleButton().getAttribute('aria-describedby');
    expect(document.getElementById(hintId)).toHaveTextContent(
      'Lange drücken oder Kontextmenü-Taste für Favorit, Bearbeiten und Löschen',
    );
  });
});

describe('TileItem – Aktionen-Panel (langer Druck / Rechtsklick / Kontextmenü-Taste)', () => {
  it('öffnet bei contextmenu die zentrierten Aktionen und ersetzt den Umschalt-Button', () => {
    renderTile();

    fireEvent.contextMenu(toggleButton());

    expect(screen.queryByRole('button', { name: /als erledigt markieren/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Aktionen für Hafermilch' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hafermilch zu Favoriten hinzufügen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hafermilch bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hafermilch entfernen' })).toBeInTheDocument();
  });

  it('fokussiert beim Öffnen die erste Aktion (wichtig bei Tastaturbedienung)', () => {
    renderTile();
    fireEvent.contextMenu(toggleButton());

    expect(screen.getByRole('button', { name: 'Hafermilch zu Favoriten hinzufügen' })).toHaveFocus();
  });

  it('öffnet die Aktionen über einen langen Pointer-Druck – ohne dass ein contextmenu-Ereignis nötig ist', () => {
    // Deckt den eigentlichen Bugfix ab: iOS Safari feuert `contextmenu` bei
    // langem Druck auf generische Elemente (z. B. einen Button) unzuverlässig.
    // Die eigene Haltedauer-Erfassung über Pointer-Events ist der primäre Weg.
    vi.useFakeTimers();
    try {
      renderTile();
      fireEvent.pointerDown(toggleButton(), { pointerType: 'touch', clientX: 10, clientY: 10 });
      act(() => vi.advanceTimersByTime(500));

      expect(screen.getByRole('button', { name: 'Hafermilch bearbeiten' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('bricht den langen Druck bei zu großer Bewegung ab (kein versehentliches Öffnen beim Scrollen)', () => {
    vi.useFakeTimers();
    try {
      renderTile();
      fireEvent.pointerDown(toggleButton(), { pointerType: 'touch', clientX: 10, clientY: 10 });
      fireEvent.pointerMove(toggleButton(), { clientX: 40, clientY: 10 });
      act(() => vi.advanceTimersByTime(500));

      expect(screen.queryByRole('button', { name: 'Hafermilch bearbeiten' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('öffnet die Aktionen NICHT bei einem kurzen Tap (Loslassen vor Ablauf) – normaler Klick bleibt möglich', async () => {
    vi.useFakeTimers();
    const { onToggle } = renderTile();
    fireEvent.pointerDown(toggleButton(), { pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.pointerUp(toggleButton());
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole('button', { name: 'Hafermilch bearbeiten' })).not.toBeInTheDocument();
    vi.useRealTimers();

    const user = userEvent.setup();
    await user.click(toggleButton());
    expect(onToggle).toHaveBeenCalledWith('item-1');
  });

  it('Favorit-Klick löst NICHT Löschen/Bearbeiten aus und lässt das Panel offen', async () => {
    const user = userEvent.setup();
    const { onToggleFavorite, onRemove, onEdit } = renderTile();
    fireEvent.contextMenu(toggleButton());

    await user.click(screen.getByRole('button', { name: 'Hafermilch zu Favoriten hinzufügen' }));

    expect(onToggleFavorite).toHaveBeenCalledWith('Hafermilch');
    expect(onRemove).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
    // Panel bleibt offen (Favorit ist ein schneller Umschalter).
    expect(screen.getByRole('button', { name: 'Hafermilch bearbeiten' })).toBeInTheDocument();
  });

  it('ruft onEdit mit der Artikel-id auf und schließt das Panel', async () => {
    const user = userEvent.setup();
    const { onEdit, onToggle } = renderTile();
    fireEvent.contextMenu(toggleButton());

    await user.click(screen.getByRole('button', { name: 'Hafermilch bearbeiten' }));

    expect(onEdit).toHaveBeenCalledWith('item-1');
    expect(onToggle).not.toHaveBeenCalled();
    // Panel geschlossen – der Umschalt-Button ist wieder da.
    expect(toggleButton()).toBeInTheDocument();
  });

  it('ruft onRemove mit der Artikel-id auf', async () => {
    const user = userEvent.setup();
    const { onRemove, onToggle, onToggleFavorite } = renderTile();
    fireEvent.contextMenu(toggleButton());

    await user.click(screen.getByRole('button', { name: 'Hafermilch entfernen' }));

    expect(onRemove).toHaveBeenCalledWith('item-1');
    expect(onToggle).not.toHaveBeenCalled();
    expect(onToggleFavorite).not.toHaveBeenCalled();
  });

  it('zeigt den Favoriten-Status im Panel über aria-pressed', () => {
    renderTile({ isFavorite: true });
    fireEvent.contextMenu(toggleButton());

    expect(
      screen.getByRole('button', { name: 'Hafermilch aus Favoriten entfernen' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('schließt das Panel über Escape', () => {
    renderTile();
    fireEvent.contextMenu(toggleButton());
    expect(screen.getByRole('button', { name: 'Hafermilch bearbeiten' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('button', { name: 'Hafermilch bearbeiten' })).not.toBeInTheDocument();
    expect(toggleButton()).toBeInTheDocument();
  });

  it('schließt das Panel bei Klick außerhalb der Kachel', () => {
    render(
      <div>
        <ul>
          <TileItem
            item={item}
            isFavorite={false}
            onToggle={vi.fn()}
            onToggleFavorite={vi.fn()}
            onRemove={vi.fn()}
            onEdit={vi.fn()}
            onSave={vi.fn()}
            onCancelEdit={vi.fn()}
            findConflict={() => null}
          />
        </ul>
        <button type="button">Außerhalb</button>
      </div>,
    );

    fireEvent.contextMenu(toggleButton());
    expect(screen.getByRole('button', { name: 'Hafermilch bearbeiten' })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Außerhalb' }));

    expect(screen.queryByRole('button', { name: 'Hafermilch bearbeiten' })).not.toBeInTheDocument();
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
