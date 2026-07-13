import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWakeLock } from '../useWakeLock';

/**
 * Mockt `navigator.wakeLock`. Der Sentinel merkt sich den `release`-Handler,
 * damit ein Auto-Release (Seite verborgen) simuliert werden kann.
 */
function mockWakeLock() {
  let releaseHandler = null;
  const sentinel = {
    release: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((type, cb) => {
      if (type === 'release') releaseHandler = cb;
    }),
  };
  const request = vi.fn().mockResolvedValue(sentinel);
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, sentinel, fireRelease: () => releaseHandler?.() };
}

afterEach(() => {
  if ('wakeLock' in navigator) delete navigator.wakeLock;
  vi.restoreAllMocks();
});

describe('useWakeLock', () => {
  it('fällt lautlos zurück, wenn die API fehlt (kein Fehler)', () => {
    // navigator.wakeLock ist nicht definiert.
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it('fordert keinen Lock an, wenn inaktiv', async () => {
    const { request } = mockWakeLock();
    renderHook(() => useWakeLock(false));
    await act(async () => {});
    expect(request).not.toHaveBeenCalled();
  });

  it('fordert bei aktiv + sichtbarer Seite einen Screen-Lock an', async () => {
    const { request } = mockWakeLock();
    renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('gibt den Lock beim Verlassen (Cleanup) frei', async () => {
    const { sentinel } = mockWakeLock();
    const { unmount } = renderHook(() => useWakeLock(true));
    await act(async () => {}); // Anforderung auflösen → Sentinel gesetzt
    unmount();
    await act(async () => {});
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('fordert bei Rückkehr auf sichtbar kontrolliert erneut an', async () => {
    const { request, fireRelease } = mockWakeLock();
    renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(1);

    // Seite verborgen → Browser gibt Lock frei (release-Event nullt die Referenz).
    act(() => fireRelease());
    // Seite wieder sichtbar (jsdom: visibilityState === 'visible').
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(request).toHaveBeenCalledTimes(2);
  });
});
