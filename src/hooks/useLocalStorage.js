import { useEffect, useState } from 'react';
import { readStorage, writeStorage } from '../lib/storage';

/**
 * State, der mit localStorage gespiegelt wird.
 * Persistenz läuft als Effekt (nicht im Setter): der State-Updater bleibt rein
 * und darf unter React StrictMode gefahrlos doppelt laufen. writeStorage ist
 * idempotent, ein Doppellauf des Effekts schadet daher nicht.
 *
 * @template T
 * @param {string} key
 * @param {T} initialValue
 * @returns {[T, import('react').Dispatch<import('react').SetStateAction<T>>]}
 */
export function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => readStorage(key, initialValue));

  useEffect(() => {
    writeStorage(key, state);
  }, [key, state]);

  return [state, setState];
}
