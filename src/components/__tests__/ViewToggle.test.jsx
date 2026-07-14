import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ViewToggle from '../ViewToggle';

describe('ViewToggle – Ansicht-Umschalter', () => {
  it('zeigt die Listenansicht standardmäßig als aktiv (aria-pressed + data-active)', () => {
    render(<ViewToggle view="list" onChange={vi.fn()} />);

    const listBtn = screen.getByRole('button', { name: 'Zur Listenansicht wechseln' });
    const gridBtn = screen.getByRole('button', { name: 'Zur Kachelansicht wechseln' });

    expect(listBtn).toHaveAttribute('aria-pressed', 'true');
    expect(listBtn).toHaveAttribute('data-active', 'true');
    expect(gridBtn).toHaveAttribute('aria-pressed', 'false');
    expect(gridBtn).toHaveAttribute('data-active', 'false');
  });

  it('markiert die Kachelansicht als aktiv, wenn view="grid" ist', () => {
    render(<ViewToggle view="grid" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Zur Kachelansicht wechseln' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Zur Listenansicht wechseln' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('ruft onChange("grid") auf, wenn das Kachel-Icon angeklickt wird', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewToggle view="list" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Zur Kachelansicht wechseln' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('ruft onChange("list") auf, wenn aus der Kachelansicht zurückgewechselt wird', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewToggle view="grid" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Zur Listenansicht wechseln' }));

    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('ist per Tastatur bedienbar (Tab + Enter)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewToggle view="list" onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Zur Listenansicht wechseln' })).toHaveFocus();

    await user.tab();
    const gridBtn = screen.getByRole('button', { name: 'Zur Kachelansicht wechseln' });
    expect(gridBtn).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('gruppiert die beiden Buttons als benannte Gruppe für Screenreader', () => {
    render(<ViewToggle view="list" onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Ansicht der Einkaufsliste' })).toBeInTheDocument();
  });
});
