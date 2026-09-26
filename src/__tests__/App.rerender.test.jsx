import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { STORAGE_KEYS } from '../lib/storage';

// Regressionsschutz für die Render-Performance: die Zeilen sind memoisiert,
// das hilft aber nur, solange App/ShoppingList ihnen stabile Callbacks geben.
// Ein Zähl-Stellvertreter für ListItem macht sichtbar, welche Zeilen bei einer
// Aktion tatsächlich neu rendern.
const renders = vi.hoisted(() => new Map());

vi.mock('../components/ListItem', async () => {
  const { memo } = await import('react');
  return {
    default: memo(function ListItemProbe({ item, onToggle }) {
      renders.set(item.name, (renders.get(item.name) ?? 0) + 1);
      return (
        <li>
          <button type="button" onClick={() => onToggle(item.id)}>
            {item.name}
          </button>
        </li>
      );
    }),
  };
});

vi.mock('../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCloudEnabled: false };
});

const item = (id, name) => ({ id, name, category: null, checked: false, createdAt: `2026-07-0${id}` });

describe('App – nur betroffene Zeilen rendern neu', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      STORAGE_KEYS.items,
      JSON.stringify([item('1', 'Tofu'), item('2', 'Hafermilch'), item('3', 'Spinat')]),
    );
    renders.clear();
  });

  it('rendert beim Abhaken keine der übrigen Zeilen neu', async () => {
    const user = userEvent.setup();
    render(<App />);
    renders.clear();

    await user.click(screen.getByRole('button', { name: 'Tofu' }));

    // Tofu ist abgehakt (wandert in den eingeklappten Erledigt-Bereich) …
    expect(screen.queryByRole('button', { name: 'Tofu' })).toBeNull();
    // … die unveränderten Zeilen bleiben unberührt.
    expect(renders.has('Hafermilch')).toBe(false);
    expect(renders.has('Spinat')).toBe(false);
  });

  it('rendert beim Öffnen des Hinzufügen-Sheets keine Zeile neu', async () => {
    const user = userEvent.setup();
    render(<App />);
    renders.clear();

    await user.click(screen.getByRole('button', { name: 'Artikel hinzufügen' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(renders.size).toBe(0);
  });
});
