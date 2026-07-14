import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardsSheet from '../CardsSheet';

/**
 * Das Kundenkarten-Overlay ist ein modaler Dialog und nutzt dieselbe
 * Fokus-Infrastruktur wie die anderen Sheets (useDialogFocus): Escape
 * schließt, der Fokus startet im Panel. Zusätzlich: verständliches
 * Fehlerfeedback statt stillem Verwerfen beim Speichern ohne Code-Inhalt.
 */
describe('CardsSheet – Fokusmanagement und Formular-Feedback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('schließt mit Escape und setzt den initialen Fokus in das Sheet', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CardsSheet onClose={onClose} />);

    // Initialer Fokus liegt auf dem ersten fokussierbaren Element im Sheet.
    expect(screen.getByRole('dialog', { name: 'Kundenkarten' })).toContainElement(
      document.activeElement,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('meldet einen fehlenden Code-Inhalt als Formularfehler statt still zu verwerfen', async () => {
    const user = userEvent.setup();
    render(<CardsSheet onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Karte hinzufügen' }));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    const codeField = screen.getByLabelText('Code-Inhalt (exakt aus der Original-App)');
    expect(codeField).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Bitte den Code-Inhalt einfügen.')).toBeInTheDocument();
    expect(codeField).toHaveFocus();

    // Nach einer Eingabe verschwindet der Fehler und die Karte wird gespeichert.
    await user.type(codeField, '1234567890');
    expect(screen.queryByText('Bitte den Code-Inhalt einfügen.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(screen.getByRole('button', { name: /Lidl Plus/, expanded: true })).toBeInTheDocument();
  });

  it('beschriftet das Namensfeld mit einem sichtbaren Label', async () => {
    const user = userEvent.setup();
    render(<CardsSheet onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Karte hinzufügen' }));
    expect(screen.getByLabelText('Name der Karte')).toHaveValue('Lidl Plus');
  });
});
