import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShoppingList from '../ShoppingList';

const item = (name, category, checked = false) => ({
  id: name,
  name,
  category,
  checked,
  createdAt: '',
});

function renderList(items, mode = 'plan') {
  return render(
    <ShoppingList
      items={items}
      favoriteSet={new Set()}
      mode={mode}
      onToggle={vi.fn()}
      onToggleFavorite={vi.fn()}
      onRemove={vi.fn()}
      onEdit={vi.fn()}
      onCheckout={vi.fn()}
    />,
  );
}

describe('ShoppingList – Kategorie-Gruppierung', () => {
  it('zeigt je Kategorie eine zugängliche Überschrift mit Anzahl', () => {
    renderList([item('Apfel', 'obst-gemuese'), item('Banane', 'obst-gemuese')]);

    // aria-label liefert den vollständigen, für Screenreader verständlichen Namen.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Obst & Gemüse, 2 Artikel' }),
    ).toBeInTheDocument();
  });

  it('rendert keine Überschrift für Kategorien ohne Artikel', () => {
    renderList([item('Apfel', 'obst-gemuese')]);

    expect(screen.queryByRole('heading', { name: /Milchalternativen/ })).toBeNull();
  });

  it('fasst unbekannte/fehlende Kategorien in einer „Sonstiges“-Überschrift zusammen', () => {
    renderList([item('X', 'nicht-existent'), item('Y', null)]);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Sonstiges, 2 Artikel' }),
    ).toBeInTheDocument();
  });

  it('hält offene und erledigte Artikel in getrennten Abschnitten, je eigenständig gruppiert', () => {
    renderList([
      item('Apfel', 'obst-gemuese', false),
      item('Banane', 'obst-gemuese', true),
    ]);

    expect(screen.getByRole('region', { name: 'Offene Artikel' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Erledigte Artikel' })).toBeInTheDocument();
    // Je Abschnitt eine eigene „Obst & Gemüse"-Überschrift mit Anzahl 1.
    expect(screen.getAllByRole('heading', { name: 'Obst & Gemüse, 1 Artikel' })).toHaveLength(2);
  });

  it('zeigt bei leerer Liste den Leerzustand statt Gruppen', () => {
    renderList([]);
    expect(screen.getByText('Deine Liste ist leer')).toBeInTheDocument();
  });
});

describe('ShoppingList – Einkaufsmodus', () => {
  it('zeigt den Fortschritt „x von y erledigt" als progressbar', () => {
    renderList(
      [item('Apfel', 'obst-gemuese', true), item('Banane', 'obst-gemuese', false)],
      'shop',
    );

    const bar = screen.getByRole('progressbar', { name: 'Einkaufsfortschritt' });
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '2');
    expect(bar).toHaveAttribute('aria-valuetext', '1 von 2 erledigt');
    expect(screen.getByText('1 von 2 erledigt')).toBeInTheDocument();
  });

  it('zeigt keine progressbar im Planungsmodus', () => {
    renderList([item('Apfel', 'obst-gemuese', false)], 'plan');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('klappt erledigte Artikel standardmäßig ein und per Button wieder aus', async () => {
    const user = userEvent.setup();
    renderList(
      [item('Apfel', 'obst-gemuese', false), item('Banane', 'obst-gemuese', true)],
      'shop',
    );

    // Disclosure ist eingeklappt; der erledigte Artikel ist nicht sichtbar.
    const disclosure = screen.getByRole('button', { name: /Erledigt/ });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: 'Banane als offen markieren' }),
    ).not.toBeInTheDocument();

    await user.click(disclosure);

    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', { name: 'Banane als offen markieren' }),
    ).toBeInTheDocument();
  });

  it('hält den Abschluss-Button auch bei eingeklappten Erledigten erreichbar', () => {
    renderList([item('Banane', 'obst-gemuese', true)], 'shop');
    expect(screen.getByRole('button', { name: 'Einkauf abschließen' })).toBeInTheDocument();
  });

  it('verschiebt die Sekundäraktionen in ein Mehr-Menü', async () => {
    const user = userEvent.setup();
    renderList([item('Apfel', 'obst-gemuese', false)], 'shop');

    // Bearbeiten/Löschen sind zunächst nicht direkt sichtbar.
    expect(screen.queryByRole('button', { name: /bearbeiten/ })).not.toBeInTheDocument();

    const more = screen.getByRole('button', { name: 'Weitere Aktionen für Apfel' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);

    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Apfel bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apfel entfernen' })).toBeInTheDocument();
  });
});
