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
