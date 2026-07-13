import { useEffect, useRef } from 'react';

/**
 * Hält den Bildschirm über die Screen Wake Lock API wach – als **progressive
 * Enhancement**: Fehlt die API (z. B. ältere iOS-Versionen, Firefox), passiert
 * lautlos nichts (keine Fehlermeldung).
 *
 * Der Lock wird nur angefordert, wenn `active` wahr ist. `active` sollte an eine
 * bewusste Nutzeraktion gekoppelt sein (hier: Wechsel in den Einkaufsmodus), da
 * Browser den Lock nur bei sichtbarer Seite gewähren.
 *
 * Verhalten:
 *  - Anfordern bei `active` + sichtbarer Seite.
 *  - Freigabe bei Deaktivierung, Unmount und Seitenwechsel (Cleanup).
 *  - Verbirgt sich die Seite, gibt der Browser den Lock automatisch frei; das
 *    `release`-Event nullt die Referenz. Kehrt die Seite sichtbar zurück, wird
 *    kontrolliert erneut angefordert (`visibilitychange`).
 *  - Alle Aufrufe sind in try/catch gekapselt und werfen nie.
 *
 * @param {boolean} active
 */
export function useWakeLock(active) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;

    let cancelled = false;

    const request = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (sentinelRef.current) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          sentinel.release?.().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        // Auto-Release (z. B. beim Verbergen der Seite) → Referenz aufräumen.
        sentinel.addEventListener?.('release', () => {
          sentinelRef.current = null;
        });
      } catch {
        // Nicht unterstützt / abgelehnt (z. B. Seite nicht sichtbar) – ignorieren.
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      sentinel?.release?.().catch(() => {});
    };
  }, [active]);
}
