import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../../hooks/useToast';

/** Testkonsole: löst über Buttons die verschiedenen Toast-Arten aus. */
function Harness({ onAction, duration }) {
  const { notify, notifyError } = useToast();
  return (
    <div>
      <button type="button" onClick={() => notify('Gespeichert')}>
        notify
      </button>
      <button type="button" onClick={() => notifyError('Kaputt')}>
        error
      </button>
      <button
        type="button"
        onClick={() => notify('Gelöscht', { action: { label: 'Rückgängig', onAction } })}
      >
        undo
      </button>
      <button type="button" onClick={() => notify('Timer', { duration })}>
        timed
      </button>
    </div>
  );
}

function renderHarness(props = {}) {
  return render(
    <ToastProvider>
      <Harness {...props} />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast-Infrastruktur', () => {
  it('meldet normale Statusmeldungen über die polite-Region', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('button', { name: 'notify' }));

    // role="status" impliziert aria-live="polite".
    expect(screen.getByRole('status')).toHaveTextContent('Gespeichert');
    // Die assertive-Region bleibt bei normalen Meldungen leer.
    expect(screen.getByRole('alert')).toHaveTextContent('');
  });

  it('meldet echte Fehler über die assertive-Region', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('button', { name: 'error' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Kaputt');
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('zeigt genau eine Undo-Aktion, ruft sie per Klick auf und schließt danach', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderHarness({ onAction });

    await user.click(screen.getByRole('button', { name: 'undo' }));

    const undo = screen.getByRole('button', { name: /Rückgängig/ });
    // Genau eine Undo-Aktion pro Meldung.
    expect(screen.getAllByRole('button', { name: /Rückgängig/ })).toHaveLength(1);

    await user.click(undo);

    expect(onAction).toHaveBeenCalledTimes(1);
    // Toast verschwindet nach dem Auslösen der Aktion.
    expect(screen.queryByRole('button', { name: /Rückgängig/ })).not.toBeInTheDocument();
  });

  it('macht die Undo-Aktion per Tastatur erreichbar', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderHarness({ onAction });

    await user.click(screen.getByRole('button', { name: 'undo' }));

    // Native <button> ohne negatives tabindex → per Tastatur fokussier- und
    // auslösbar.
    const undo = screen.getByRole('button', { name: /Rückgängig/ });
    undo.focus();
    expect(undo).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('pausiert den Auto-Dismiss bei Hover', () => {
    vi.useFakeTimers();
    renderHarness({ duration: 1000 });

    fireEvent.click(screen.getByRole('button', { name: 'timed' }));
    // '.toast__message' grenzt den sichtbaren Toast von der Live-Region ab, die
    // denselben Text spiegelt.
    const message = () => screen.queryByText('Timer', { selector: '.toast__message' });
    const toast = message().closest('.toast');
    expect(toast).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(500));
    expect(message()).toBeInTheDocument();

    // Hover pausiert den Timer: auch nach langer Zeit bleibt der Toast stehen.
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(5000));
    expect(message()).toBeInTheDocument();

    // Nach dem Verlassen läuft die Restzeit weiter ab.
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(1000));
    expect(message()).not.toBeInTheDocument();
  });

  it('schließt nach Ablauf der Anzeigedauer automatisch', () => {
    vi.useFakeTimers();
    renderHarness({ duration: 1000 });

    fireEvent.click(screen.getByRole('button', { name: 'timed' }));
    const message = () => screen.queryByText('Timer', { selector: '.toast__message' });
    expect(message()).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(message()).not.toBeInTheDocument();
  });
});
