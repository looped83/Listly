import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { STORAGE_KEYS } from '../lib/storage';

// Lokaler Modus (kein Netzwerk/Realtime nötig) – der Ansicht-Umschalter selbst
// ist unabhängig vom Sync-Modus, daher genügt hier isCloudEnabled: false.
vi.mock('../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCloudEnabled: false };
});

describe('App – Ansicht-Umschalter im Header', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('startet standardmäßig in der Listenansicht', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Zur Listenansicht wechseln' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Zur Kachelansicht wechseln' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('wechselt zur Kachelansicht und speichert die Wahl', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Zur Kachelansicht wechseln' }));

    expect(screen.getByRole('button', { name: 'Zur Kachelansicht wechseln' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(localStorage.getItem(STORAGE_KEYS.viewMode)).toBe(JSON.stringify('grid'));
  });

  it('wechselt wieder zurück zur Listenansicht', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Zur Kachelansicht wechseln' }));
    await user.click(screen.getByRole('button', { name: 'Zur Listenansicht wechseln' }));

    expect(screen.getByRole('button', { name: 'Zur Listenansicht wechseln' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(localStorage.getItem(STORAGE_KEYS.viewMode)).toBe(JSON.stringify('list'));
  });

  it('lädt eine zuvor gespeicherte Kachelansicht beim (erneuten) Öffnen', () => {
    localStorage.setItem(STORAGE_KEYS.viewMode, JSON.stringify('grid'));

    render(<App />);

    expect(screen.getByRole('button', { name: 'Zur Kachelansicht wechseln' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('fällt bei einem unbekannten/beschädigten gespeicherten Wert auf die Listenansicht zurück', () => {
    localStorage.setItem(STORAGE_KEYS.viewMode, JSON.stringify('irgendwas-unbekanntes'));

    render(<App />);

    expect(screen.getByRole('button', { name: 'Zur Listenansicht wechseln' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
