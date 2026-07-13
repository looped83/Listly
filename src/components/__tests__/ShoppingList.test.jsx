import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ShoppingList from '../ShoppingList';

const item = (name, category, checked = false) => ({
  id: name,
  name,
  category,
  checked,
  createdAt: '',
});

function renderList(items) {
  return render(
    <ShoppingList
      items={items}
      favoriteSet={new Set()}
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
