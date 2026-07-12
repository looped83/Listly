import { useCallback, useState } from 'react';
import { readStorage, writeStorage } from '../lib/storage';

/**
 * State, der synchron mit localStorage gespiegelt wird.
 * Schreibt direkt im Setter (kein Effect) – vermeidet zusätzliche Re-Renders
 * und stellt sicher, dass Daten auch bei sofortigem App-Neustart persistiert sind.
 *
 * @template T
 * @param {string} key
 * @param {T} initialValue
 * @returns {[T, (updater: T | ((prev: T) => T)) => void]}
 */
export function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => readStorage(key, initialValue));

  const setValue = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        writeStorage(key, next);
        return next;
      });
    },
    [key],
  );

  return [state, setValue];
}
