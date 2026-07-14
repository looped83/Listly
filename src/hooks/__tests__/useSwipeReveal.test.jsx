import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, fireEvent, screen } from '@testing-library/react';
import { useSwipeReveal } from '../useSwipeReveal';

const ROW_WIDTH = 300; // px, simulierte Zeilenbreite (jsdom liefert sonst 0)

function Harness({ onDelete, deleteThresholdRatio }) {
  const { rowProps, actionsProps, backdropProps } = useSwipeReveal({
    revealWidth: 156,
    openThreshold: 56,
    deleteThresholdRatio,
    onDelete,
  });
  return (
    <ul>
      <li>
        <div data-testid="backdrop" {...backdropProps} />
        <div data-testid="actions" {...actionsProps}>
          <button type="button">Löschen</button>
        </div>
        <div data-testid="row" {...rowProps}>
          Zeile
        </div>
      </li>
    </ul>
  );
}

function touchAt(clientX) {
  return { touches: [{ clientX, clientY: 0 }] };
}

function renderHarness(overrides = {}) {
  const onDelete = vi.fn();
  render(<Harness onDelete={onDelete} deleteThresholdRatio={0.72} {...overrides} />);
  const row = screen.getByTestId('row');
  vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
    /** @type {DOMRect} */ ({ width: ROW_WIDTH, height: 60, top: 0, left: 0, right: 0, bottom: 0 }),
  );
  return { onDelete, row, backdrop: screen.getByTestId('backdrop') };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useSwipeReveal – kompletter Wisch löscht direkt', () => {
  it('löscht nach der Animation, wenn über die Lösch-Schwelle gewischt und losgelassen wird', () => {
    vi.useFakeTimers();
    const { onDelete, row } = renderHarness();

    fireEvent.touchStart(row, touchAt(300));
    // dx = -260, deutlich über 0,72 * 300 = 216.
    fireEvent.touchMove(row, touchAt(40));
    fireEvent.touchEnd(row);

    expect(onDelete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('löscht NICHT bei einem normalen Wisch – öffnet stattdessen nur die Aktionsleiste', () => {
    const { onDelete, row } = renderHarness();

    fireEvent.touchStart(row, touchAt(300));
    // dx = -100: über openThreshold (56), weit unter der Lösch-Schwelle (216).
    fireEvent.touchMove(row, touchAt(200));
    fireEvent.touchEnd(row);

    expect(onDelete).not.toHaveBeenCalled();
    expect(row).toHaveAttribute('data-revealed', 'true');
  });

  it('löscht NICHT bei einem sehr kurzen Wisch – schließt zurück auf den Ausgangszustand', () => {
    const { onDelete, row } = renderHarness();

    fireEvent.touchStart(row, touchAt(300));
    fireEvent.touchMove(row, touchAt(280)); // dx = -20, unter openThreshold
    fireEvent.touchEnd(row);

    expect(onDelete).not.toHaveBeenCalled();
    expect(row).toHaveAttribute('data-revealed', 'false');
  });
});

describe('useSwipeReveal – Grün→Rot-Fortschritt (--swipe-progress)', () => {
  it('bleibt bei 0, solange nur die normale Aktionsleiste aufgedeckt wird (bis revealWidth)', () => {
    const { backdrop, row } = renderHarness();

    fireEvent.touchStart(row, touchAt(300));
    fireEvent.touchMove(row, touchAt(200)); // dx = -100, unter revealWidth (156)

    expect(backdrop.style.getPropertyValue('--swipe-progress')).toBe('0');
  });

  it('wächst zwischen revealWidth und der Lösch-Schwelle auf einen Wert zwischen 0 und 1', () => {
    const { backdrop, row } = renderHarness();

    fireEvent.touchStart(row, touchAt(300));
    fireEvent.touchMove(row, touchAt(120)); // dx = -180, zwischen 156 und 216

    const progress = Number(backdrop.style.getPropertyValue('--swipe-progress'));
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
  });

  it('erreicht 1, sobald die Lösch-Schwelle erreicht/überschritten ist', () => {
    const { backdrop, row } = renderHarness();

    fireEvent.touchStart(row, touchAt(300));
    fireEvent.touchMove(row, touchAt(40)); // dx = -260, über der Schwelle (216)

    expect(backdrop.style.getPropertyValue('--swipe-progress')).toBe('1');
  });

  it('setzt den Fortschritt zurück auf 0, wenn ohne Löschen nur die Aktionsleiste einrastet', () => {
    const { backdrop, row } = renderHarness();

    fireEvent.touchStart(row, touchAt(300));
    fireEvent.touchMove(row, touchAt(120)); // Fortschritt > 0, aber unter der Lösch-Schwelle
    fireEvent.touchEnd(row); // rastet ein (geöffnet) statt zu löschen

    expect(row).toHaveAttribute('data-revealed', 'true');
    expect(backdrop.style.getPropertyValue('--swipe-progress')).toBe('0');
  });
});
