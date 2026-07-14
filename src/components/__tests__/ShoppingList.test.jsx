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

function renderList(items, overrides = {}) {
  return render(
    <ShoppingList
      items={items}
      favoriteSet={new Set()}
      onToggle={vi.fn()}
      onToggleFavorite={vi.fn()}
      onRemove={vi.fn()}
      onEdit={vi.fn()}
      onCheckout={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ShoppingList – Kategorie-Gruppierung', () => {
  it('zeigt je Kategorie eine Überschrift mit dem Kategorienamen (ohne Anzahl)', () => {
    renderList([item('Apfel', 'obst-gemuese'), item('Banane', 'obst-gemuese')]);

    expect(screen.getByRole('heading', { level: 2, name: 'Obst & Gemüse' })).toBeInTheDocument();
    // Keine Artikel-Anzahl mehr in der Überschrift.
    expect(screen.queryByRole('heading', { name: /Artikel/ })).toBeNull();
  });

  it('rendert keine Überschrift für Kategorien ohne Artikel', () => {
    renderList([item('Apfel', 'obst-gemuese')]);

    expect(screen.queryByRole('heading', { name: /Milchalternativen/ })).toBeNull();
  });

  it('fasst unbekannte/fehlende Kategorien in einer „Sonstiges“-Überschrift zusammen', () => {
    renderList([item('X', 'nicht-existent'), item('Y', null)]);

    expect(screen.getByRole('heading', { level: 2, name: 'Sonstiges' })).toBeInTheDocument();
  });

  it('hält offene und erledigte Artikel in getrennten Abschnitten, je eigenständig gruppiert', async () => {
    const user = userEvent.setup();
    renderList([
      item('Apfel', 'obst-gemuese', false),
      item('Banane', 'obst-gemuese', true),
    ]);

    expect(screen.getByRole('region', { name: 'Offene Artikel' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Erledigte Artikel' })).toBeInTheDocument();
    // Offen: eine sichtbare Überschrift; die Erledigt-Gruppe ist eingeklappt.
    expect(screen.getAllByRole('heading', { name: 'Obst & Gemüse' })).toHaveLength(1);

    // Nach dem Aufklappen erscheint die zweite (erledigte) Gruppe.
    await user.click(screen.getByRole('button', { name: /Erledigt/ }));
    expect(screen.getAllByRole('heading', { name: 'Obst & Gemüse' })).toHaveLength(2);
  });

  it('zeigt bei leerer Liste den Leerzustand statt Gruppen', () => {
    renderList([]);
    expect(screen.getByText('Deine Liste ist leer')).toBeInTheDocument();
  });
});

describe('ShoppingList – Fortschritt & Erledigt (Standard)', () => {
  it('zeigt den Fortschritt „x von y erledigt" als progressbar (ab dem ersten Abhaken)', () => {
    renderList([item('Apfel', 'obst-gemuese', true), item('Banane', 'obst-gemuese', false)]);

    const bar = screen.getByRole('progressbar', { name: 'Einkaufsfortschritt' });
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '2');
    expect(bar).toHaveAttribute('aria-valuetext', '1 von 2 erledigt');
    expect(screen.getByText('1 von 2 erledigt')).toBeInTheDocument();
  });

  it('zeigt keine progressbar, solange nichts abgehakt ist', () => {
    renderList([item('Apfel', 'obst-gemuese', false)]);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('klappt erledigte Artikel standardmäßig ein und per Button wieder aus', async () => {
    const user = userEvent.setup();
    renderList([item('Apfel', 'obst-gemuese', false), item('Banane', 'obst-gemuese', true)]);

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
    renderList([item('Banane', 'obst-gemuese', true)]);
    expect(screen.getByRole('button', { name: 'Einkauf abschließen' })).toBeInTheDocument();
  });

  it('bietet Favorit/Bearbeiten/Löschen je Zeile ohne „Mehr“-Menü an', () => {
    renderList([item('Apfel', 'obst-gemuese', false)]);

    // Kein „Mehr“-Menü mehr – die Aktionen warten hinter dem Swipe, bleiben aber
    // (fokussierbar) erreichbar.
    expect(screen.queryByRole('button', { name: /Weitere Aktionen/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Apfel zu Favoriten hinzufügen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apfel bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apfel entfernen' })).toBeInTheDocument();
  });
});

describe('ShoppingList – Kachelansicht (viewMode)', () => {
  it('rendert ohne viewMode-Prop standardmäßig als Liste (.list, keine .tile-grid)', () => {
    renderList([item('Apfel', 'obst-gemuese')]);

    expect(document.querySelector('.list')).toBeInTheDocument();
    expect(document.querySelector('.tile-grid')).not.toBeInTheDocument();
  });

  it('rendert bei viewMode="grid" ein Kachel-Grid statt der Liste', () => {
    renderList([item('Apfel', 'obst-gemuese')], { viewMode: 'grid' });

    expect(document.querySelector('.tile-grid')).toBeInTheDocument();
    expect(document.querySelector('.list')).not.toBeInTheDocument();
  });

  it('zeigt in beiden Ansichten dieselben Artikel, nach Kategorie gruppiert', () => {
    const items = [item('Apfel', 'obst-gemuese'), item('Banane', 'obst-gemuese')];

    const { unmount } = renderList(items, { viewMode: 'list' });
    expect(screen.getByRole('heading', { level: 2, name: 'Obst & Gemüse' })).toBeInTheDocument();
    expect(screen.getByText('Apfel')).toBeInTheDocument();
    expect(screen.getByText('Banane')).toBeInTheDocument();
    unmount();

    renderList(items, { viewMode: 'grid' });
    expect(screen.getByRole('heading', { level: 2, name: 'Obst & Gemüse' })).toBeInTheDocument();
    expect(screen.getByText('Apfel')).toBeInTheDocument();
    expect(screen.getByText('Banane')).toBeInTheDocument();
  });

  it('ruft in der Kachelansicht dieselben Handler wie in der Listenansicht auf', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onToggleFavorite = vi.fn();
    const onRemove = vi.fn();
    const onEdit = vi.fn();

    renderList([item('Apfel', 'obst-gemuese')], {
      viewMode: 'grid',
      onToggle,
      onToggleFavorite,
      onRemove,
      onEdit,
    });

    await user.click(screen.getByRole('button', { name: 'Apfel als erledigt markieren' }));
    expect(onToggle).toHaveBeenCalledWith('Apfel');

    await user.click(screen.getByRole('button', { name: 'Apfel zu Favoriten hinzufügen' }));
    expect(onToggleFavorite).toHaveBeenCalledWith('Apfel');

    await user.click(screen.getByRole('button', { name: 'Apfel bearbeiten' }));
    expect(onEdit).toHaveBeenCalledWith('Apfel');

    await user.click(screen.getByRole('button', { name: 'Apfel entfernen' }));
    expect(onRemove).toHaveBeenCalledWith('Apfel');
  });

  it('zeigt den Fortschritt und die Erledigt-Sektion auch in der Kachelansicht', async () => {
    const user = userEvent.setup();
    renderList([item('Apfel', 'obst-gemuese', true), item('Banane', 'obst-gemuese', false)], {
      viewMode: 'grid',
    });

    expect(screen.getByRole('progressbar', { name: 'Einkaufsfortschritt' })).toBeInTheDocument();
    const disclosure = screen.getByRole('button', { name: /Erledigt/ });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    await user.click(disclosure);
    expect(
      screen.getByRole('button', { name: 'Apfel als offen markieren' }),
    ).toBeInTheDocument();
  });

  it('zeigt bei leerer Liste denselben Leerzustand wie in der Listenansicht', () => {
    renderList([], { viewMode: 'grid' });
    expect(screen.getByText('Deine Liste ist leer')).toBeInTheDocument();
  });
});
