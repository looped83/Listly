import { useEffect, useState } from 'react';

/**
 * State, der mit sessionStorage gespiegelt wird – also **sitzungsbezogen**:
 * überlebt einen Reload/Seitenwechsel innerhalb desselben Tabs, aber bewusst
 * NICHT dauerhaft (anders als localStorage). Gedacht für flüchtige UI-Zustände
 * wie den aktiven Modus, die nicht über Sitzungen hinweg kleben sollen.
 *
 * Persistenz läuft als Effekt (nicht im Setter): der State-Updater bleibt rein
 * und darf unter React StrictMode gefahrlos doppelt laufen. Alle Zugriffe sind
 * defensiv (try/catch) – im Private Mode oder ohne sessionStorage fällt der Hook
 * auf reinen In-Memory-State zurück.
 *
 * @template T
 * @param {string} key
 * @param {T} initialValue
 * @returns {[T, import('react').Dispatch<import('react').SetStateAction<T>>]}
 */
export function useSessionStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? initialValue : JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // sessionStorage nicht verfügbar (z. B. Private Mode) – ignorieren.
    }
  }, [key, state]);

  return [state, setState];
}
