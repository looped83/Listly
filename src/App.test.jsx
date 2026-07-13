import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

/** Öffnet den Abschluss-Dialog über die primäre Aktion in der Erledigt-Sektion. */
async function openCheckout(user) {
  await user.click(await screen.findByRole('button', { name: 'Einkauf abschließen' }));
  return screen.findByRole('dialog');
}

/** Öffnet den Dialog und bestätigt den Standardabschluss (nur Abgehaktes). */
async function checkoutDefault(user) {
  const dialog = await openCheckout(user);
  await user.click(within(dialog).getByRole('button', { name: 'Einkauf abschließen' }));
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

  it('completes the purchase (default) and restores list plus history via undo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');

    await user.click(screen.getByRole('button', { name: 'Testartikel als erledigt markieren' }));
    await checkoutDefault(user);

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
    await checkoutDefault(user);

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

    // Artikel erledigen und abschließen, damit er im Verlauf (und als
    // Häufig-gekauft-Chip) auftaucht.
    await addItem(user, 'Kichererbsen');
    await user.click(screen.getByRole('button', { name: 'Kichererbsen als erledigt markieren' }));
    await checkoutDefault(user);
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

describe('Einkauf abschließen – Dialog (local mode)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  it('bietet keinen Abschluss an, solange nichts abgehakt ist', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');

    // Nur offene Artikel → keine sinnlose Abschlussaktion.
    expect(screen.queryByRole('button', { name: 'Einkauf abschließen' })).not.toBeInTheDocument();
  });

  it('zeigt Anzahl abgehakter und offener Artikel sowie die Konsequenz', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'GekauftA');
    await addItem(user, 'GekauftB');
    await addItem(user, 'Offen');
    await user.click(screen.getByRole('button', { name: 'GekauftA als erledigt markieren' }));
    await user.click(screen.getByRole('button', { name: 'GekauftB als erledigt markieren' }));

    const dialog = await openCheckout(user);

    // Zwei abgehakt, einer offen.
    expect(within(dialog).getByText('2', { selector: '.dialog__count strong' })).toBeInTheDocument();
    expect(within(dialog).getByText('1', { selector: '.dialog__count strong' })).toBeInTheDocument();
    expect(within(dialog).getByText(/2 Artikel werden in den Kaufverlauf verbucht/)).toBeInTheDocument();
    // Standard: offene Artikel bleiben erhalten.
    expect(within(dialog).getByText(/1 offener Artikel bleibt auf der Liste/)).toBeInTheDocument();
  });

  it('verbucht standardmäßig nur abgehakte Artikel; offene bleiben bestehen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Gekauft');
    await addItem(user, 'Offen');
    await user.click(screen.getByRole('button', { name: 'Gekauft als erledigt markieren' }));

    await checkoutDefault(user);

    // Abgehaktes ist weg und im Verlauf; Offenes bleibt auf der Liste.
    expect(screen.queryByRole('button', { name: 'Gekauft als offen markieren' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Offen als erledigt markieren' })).toBeInTheDocument();
    expect(screen.getByText('1 offen')).toBeInTheDocument();
    expect(screen.getByText('×1')).toBeInTheDocument();
  });

  it('schließt mit „Alle als gekauft" auch offene Artikel ab und leert die Liste', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Gekauft');
    await addItem(user, 'Offen');
    await user.click(screen.getByRole('button', { name: 'Gekauft als erledigt markieren' }));

    const dialog = await openCheckout(user);
    await user.click(within(dialog).getByRole('checkbox'));
    // Konsequenztext aktualisiert sich auf „Liste ist danach leer".
    expect(within(dialog).getByText(/Die Liste ist danach leer/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Einkauf abschließen' }));

    // Beide Artikel verbucht, Liste leer.
    expect(screen.getByText('Deine Liste ist leer')).toBeInTheDocument();
    // Beide als Verlaufs-Chips (je ×1).
    expect(screen.getByRole('button', { name: 'Gekauft×1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Offen×1' })).toBeInTheDocument();
  });

  it('macht einen „Alle abschließen"-Abschluss vollständig rückgängig', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Gekauft');
    await addItem(user, 'Offen');
    await user.click(screen.getByRole('button', { name: 'Gekauft als erledigt markieren' }));

    const dialog = await openCheckout(user);
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Einkauf abschließen' }));

    await user.click(await screen.findByRole('button', { name: /Rückgängig/ }));

    // Vorheriger Zustand: „Gekauft" wieder erledigt, „Offen" wieder offen, kein Verlauf.
    expect(
      await screen.findByRole('button', { name: 'Gekauft als offen markieren' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Offen als erledigt markieren' })).toBeInTheDocument();
    expect(screen.queryByText('×1')).not.toBeInTheDocument();
  });

  it('bricht ohne Wirkung ab (Abbrechen-Button)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');
    await user.click(screen.getByRole('button', { name: 'Testartikel als erledigt markieren' }));

    const dialog = await openCheckout(user);
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    // Dialog zu, nichts verbucht, Artikel bleibt erledigt auf der Liste.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Testartikel als offen markieren' })).toBeInTheDocument();
    expect(screen.queryByText('×1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rückgängig/ })).not.toBeInTheDocument();
  });

  it('bricht per Escape ab und gibt den Fokus an die auslösende Schaltfläche zurück', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');
    await user.click(screen.getByRole('button', { name: 'Testartikel als erledigt markieren' }));

    const trigger = await screen.findByRole('button', { name: 'Einkauf abschließen' });
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Fokus kehrt zur auslösenden Schaltfläche zurück.
    expect(trigger).toHaveFocus();
  });

  it('legt den initialen Fokus auf die primäre Aktion', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Testartikel');
    await user.click(screen.getByRole('button', { name: 'Testartikel als erledigt markieren' }));

    const dialog = await openCheckout(user);

    expect(within(dialog).getByRole('button', { name: 'Einkauf abschließen' })).toHaveFocus();
  });
});

describe('Artikel bearbeiten (local mode)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  async function openEdit(user, itemName) {
    await user.click(await screen.findByRole('button', { name: `${itemName} bearbeiten` }));
    return screen.findByRole('dialog');
  }

  it('ergänzt Menge, Einheit und Notiz und zeigt sie kompakt an', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Hafermilch');

    const dialog = await openEdit(user, 'Hafermilch');
    await user.type(within(dialog).getByLabelText('Menge'), '2');
    await user.type(within(dialog).getByLabelText('Einheit'), 'l');
    await user.type(within(dialog).getByLabelText('Notiz'), 'ungesüßt');
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    // Kompaktdarstellung „2 l" + Notizzeile.
    expect(await screen.findByText('2 l')).toHaveClass('list-item__qty');
    expect(screen.getByText('ungesüßt')).toHaveClass('list-item__note');
    // Bestätigungsmeldung.
    expect(screen.getByRole('status')).toHaveTextContent('„Hafermilch“ aktualisiert');
  });

  it('gibt beim Schließen (Escape) den Fokus an die Bearbeiten-Schaltfläche zurück', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Hafermilch');

    const trigger = await screen.findByRole('button', { name: 'Hafermilch bearbeiten' });
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('führt beim Umbenennen auf einen vorhandenen Artikel bewusst zusammen (keine Dublette)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Apfel');
    await addItem(user, 'Birne');

    const dialog = await openEdit(user, 'Apfel');
    const nameInput = within(dialog).getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Birne');
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    // Zusammenführungs-Abfrage statt stiller Dublette.
    await user.click(await screen.findByRole('button', { name: 'Zusammenführen' }));

    // Genau ein Artikel „Birne", kein „Apfel" mehr.
    expect(screen.getByText('1 offen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Birne als erledigt markieren' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Apfel als erledigt markieren' }),
    ).not.toBeInTheDocument();
  });

  it('lässt den Favoriten einer Umbenennung folgen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addItem(user, 'Apfel');

    // Apfel favorisieren.
    await user.click(screen.getByRole('button', { name: 'Apfel zu Favoriten hinzufügen' }));

    const dialog = await openEdit(user, 'Apfel');
    const nameInput = within(dialog).getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Boskop');
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    // Der Favoritenstatus ist mitgewandert: „Boskop" ist favorisiert, „Apfel" existiert nicht mehr.
    expect(
      await screen.findByRole('button', { name: 'Boskop aus Favoriten entfernen' }),
    ).toBeInTheDocument();
  });
});
