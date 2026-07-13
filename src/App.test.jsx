import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// App synct standardmäßig über Supabase (siehe supabaseConfig.js). Für den
// Smoke-Test wird der lokale Modus erzwungen, damit keine echten Netzwerk-
// aufrufe stattfinden und das Verhalten deterministisch bleibt.
vi.mock('./lib/supabase', () => ({
  isCloudEnabled: false,
  getSupabase: () => Promise.resolve(null),
  rowToItem: (row) => row,
  TABLE: 'list_items',
  LIST_ID: 'test-list',
}));

const { default: App } = await import('./App');

function createLocalStorageMock() {
  let store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

describe('App (smoke test, local mode)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  it('renders the header and the empty-state list on first launch', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Listly' })).toBeInTheDocument();
    expect(screen.getByText('Deine Liste ist leer')).toBeInTheDocument();
  });

  it('adds a typed item to the open list', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByRole('combobox', { name: 'Artikel hinzufügen' });
    await user.type(input, 'Testartikel');
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(await screen.findByText('Testartikel')).toBeInTheDocument();
    expect(screen.getByText('1 offen')).toBeInTheDocument();
    // Eingabefeld wird nach dem Hinzufügen geleert.
    expect(input).toHaveValue('');
  });

  it('persists an added item to (mocked) localStorage in local mode', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByRole('combobox', { name: 'Artikel hinzufügen' });
    await user.type(input, 'Hafermilch');
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    await screen.findByText('Hafermilch');

    const stored = JSON.parse(localStorage.getItem('listly.items'));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: 'Hafermilch', checked: false });
  });
});

async function addItem(user, name) {
  const input = screen.getByRole('combobox', { name: 'Artikel hinzufügen' });
  await user.type(input, name);
  await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));
  await screen.findByText(name);
}

describe('Feedback & Undo (local mode)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  it('deletes a single item and restores it via undo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');

    await user.click(screen.getByRole('button', { name: 'Testartikel entfernen' }));

    // Artikel ist aus der Liste verschwunden, ein Undo-Toast erscheint.
    expect(screen.queryByRole('button', { name: 'Testartikel entfernen' })).not.toBeInTheDocument();
    const undo = await screen.findByRole('button', { name: /Rückgängig/ });

    await user.click(undo);

    // Undo stellt den Artikel unverändert wieder her.
    expect(await screen.findByRole('button', { name: 'Testartikel entfernen' })).toBeInTheDocument();
  });

  it('archives checked items and restores list plus history via undo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');

    await user.click(screen.getByRole('button', { name: 'Testartikel als erledigt markieren' }));
    await user.click(await screen.findByRole('button', { name: /Erledigte entfernen/ }));

    // Verbucht: Artikel verlässt die Liste, taucht als Verlaufs-Chip (×1) auf.
    expect(screen.queryByText('Erledigt')).not.toBeInTheDocument();
    expect(screen.getByText('×1')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Rückgängig/ }));

    // Voller Vorzustand: Artikel wieder erledigt in der Liste, Verlauf zurückgesetzt.
    expect(
      await screen.findByRole('button', { name: 'Testartikel als offen markieren' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('×1')).not.toBeInTheDocument();
  });

  it('books the purchase history exactly once under React StrictMode', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await addItem(user, 'Testartikel');

    await user.click(screen.getByRole('button', { name: 'Testartikel als erledigt markieren' }));
    await user.click(await screen.findByRole('button', { name: /Erledigte entfernen/ }));

    // Genau einmal verbucht: der Chip zeigt ×1, niemals ×2.
    expect(await screen.findByText('×1')).toBeInTheDocument();
    expect(screen.queryByText('×2')).not.toBeInTheDocument();
  });
});

describe('Dubletten-Feedback beim Hinzufügen (local mode)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  it('bestätigt einen neuen Artikel mit Erfolgsmeldung', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addItem(user, 'Testartikel');

    expect(await screen.findByRole('status')).toHaveTextContent('„Testartikel“ hinzugefügt');
    expect(screen.getByText('1 offen')).toBeInTheDocument();
  });

  it('verhindert eine Dublette bei manueller Eingabe eines bereits offenen Artikels', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');

    // Groß-/Kleinschreibung und zusätzliche Leerzeichen dürfen die Erkennung
    // nicht umgehen.
    const input = screen.getByRole('combobox', { name: 'Artikel hinzufügen' });
    await user.type(input, '  TESTARTIKEL  ');
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '„Testartikel“ steht bereits auf der Liste',
    );
    // Keine Dublette: weiterhin nur ein offener Artikel.
    expect(screen.getByText('1 offen')).toBeInTheDocument();
    expect(screen.getAllByText('Testartikel')).toHaveLength(1);
  });

  it('reaktiviert einen erledigten Artikel bei manueller Eingabe statt ihn zu duplizieren', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');
    await user.click(screen.getByRole('button', { name: 'Testartikel als erledigt markieren' }));

    // Anderer Groß-/Kleinschreibungs-Fall als beim Original – muss trotzdem
    // als derselbe Artikel erkannt werden.
    const input = screen.getByRole('combobox', { name: 'Artikel hinzufügen' });
    await user.type(input, 'testartikel');
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '„Testartikel“ wurde wieder aktiviert',
    );
    // Wieder offen: der Umschalt-Button zeigt wieder das Label für "erledigt
    // markieren" (nicht mehr "als offen markieren").
    expect(
      await screen.findByRole('button', { name: 'Testartikel als erledigt markieren' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Testartikel als offen markieren' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('1 offen')).toBeInTheDocument();
    expect(screen.getAllByText('Testartikel')).toHaveLength(1);
  });

  it('meldet Dubletten über die polite-Region, nicht als Fehler', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');

    const input = screen.getByRole('combobox', { name: 'Artikel hinzufügen' });
    await user.type(input, 'Testartikel');
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(await screen.findByRole('status')).toHaveTextContent('steht bereits auf der Liste');
    expect(screen.getByRole('alert')).toHaveTextContent('');
  });

  it('behält den Fokus im Eingabefeld nach einer abgelehnten Dublette', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');

    const input = screen.getByRole('combobox', { name: 'Artikel hinzufügen' });
    await user.type(input, 'Testartikel');
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    await screen.findByRole('status');
    expect(input).toHaveFocus();
  });

  it('zeigt für Autovervollständigung und Chips dieselben Statusmeldungen wie manuelle Eingabe', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Artikel erledigen und archivieren, damit er im Verlauf (und als
    // Häufig-gekauft-Chip) auftaucht.
    await addItem(user, 'Kichererbsen');
    await user.click(screen.getByRole('button', { name: 'Kichererbsen als erledigt markieren' }));
    await user.click(await screen.findByRole('button', { name: /Erledigte entfernen/ }));
    await screen.findByText('×1');

    // Über den Häufig-gekauft-Chip erneut hinzufügen: derselbe Code-Pfad wie
    // manuelle Eingabe, daher dieselbe Erfolgsmeldung. (Der Chip hat eine
    // eigene "Entfernen"-Schaltfläche, daher exakter Name statt Teilstring.)
    const chipAdd = screen.getByRole('button', { name: 'Kichererbsen×1' });
    await user.click(chipAdd);

    expect(await screen.findByRole('status')).toHaveTextContent('„Kichererbsen“ hinzugefügt');
    expect(screen.getByText('1 offen')).toBeInTheDocument();

    // Erneuter Klick auf denselben Chip ist nicht mehr möglich (Artikel steht
    // jetzt auf der Liste und wird aus den Vorschlägen ausgeblendet) – das
    // Eingabefeld bleibt aber sinnvoll fokussiert für die nächste Eingabe.
    const input = screen.getByRole('combobox', { name: 'Artikel hinzufügen' });
    expect(input).toHaveFocus();
  });
});
