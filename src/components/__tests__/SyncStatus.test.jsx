import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import SyncStatus from '../SyncStatus';

afterEach(() => {
  vi.useRealTimers();
});

describe('SyncStatus – dezenter Hinweis hinter dem Titel', () => {
  it('zeigt bei „live“ gar nichts an', () => {
    render(<SyncStatus status="live" />);
    expect(document.querySelector('.header-sync')).not.toBeInTheDocument();
  });

  it('zeigt bei „connecting“ gar nichts an', () => {
    render(<SyncStatus status="connecting" />);
    expect(document.querySelector('.header-sync')).not.toBeInTheDocument();
  });

  it('zeigt bei „local“ ein Icon (ohne Text) mit erklärendem Tooltip/aria-label', () => {
    render(<SyncStatus status="local" />);
    const icon = document.querySelector('.header-sync');
    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute('title')).toContain('diesem Gerät');
    expect(icon.getAttribute('aria-label')).toContain('diesem Gerät');
    // Kein sichtbarer Text daneben.
    expect(icon).toHaveTextContent('');
  });

  it('zeigt bei „error“ (offline) ebenfalls das Icon', () => {
    render(<SyncStatus status="error" />);
    expect(document.querySelector('.header-sync')).toBeInTheDocument();
  });

  it('ist zunächst sichtbar und verblasst nach der Anzeigedauer von selbst', () => {
    vi.useFakeTimers();
    render(<SyncStatus status="local" />);

    const icon = document.querySelector('.header-sync');
    expect(icon).toHaveAttribute('data-visible', 'true');

    act(() => vi.advanceTimersByTime(2999));
    expect(icon).toHaveAttribute('data-visible', 'true');

    act(() => vi.advanceTimersByTime(1));
    expect(icon).toHaveAttribute('data-visible', 'false');
  });

  it('blitzt bei jedem Wechsel zwischen lokal/offline erneut auf', () => {
    vi.useFakeTimers();
    const { rerender } = render(<SyncStatus status="local" />);

    act(() => vi.advanceTimersByTime(3000));
    expect(document.querySelector('.header-sync')).toHaveAttribute('data-visible', 'false');

    rerender(<SyncStatus status="error" />);
    expect(document.querySelector('.header-sync')).toHaveAttribute('data-visible', 'true');
  });

  it('bleibt nach dem Verblassen im DOM (per Hover/Fokus weiter erreichbar)', () => {
    vi.useFakeTimers();
    render(<SyncStatus status="local" />);

    act(() => vi.advanceTimersByTime(3000));

    const icon = document.querySelector('.header-sync');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('data-visible', 'false');
    expect(icon).toHaveAttribute('tabIndex', '0');
  });
});
