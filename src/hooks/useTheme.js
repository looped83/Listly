import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../lib/storage';

// theme_color der <meta>-Angabe je aktivem Modus (an die CSS-Tokens angelehnt).
const META_THEME_COLOR = {
  light: '#faf6ee',
  dark: '#16201b',
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Verwaltet das Farbschema:
 * - 'system' folgt prefers-color-scheme (reaktiv),
 * - 'light'/'dark' überschreiben manuell,
 * - Auswahl wird in localStorage gespeichert,
 * - setzt data-theme am <html> und aktualisiert die theme-color-Meta.
 */
export function useTheme() {
  const [preference, setPreference] = useLocalStorage(STORAGE_KEYS.theme, 'system');
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia(DARK_QUERY);
    const handleChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', META_THEME_COLOR[resolvedTheme]);
  }, [resolvedTheme]);

  // Zyklus für den manuellen Umschalter: light → dark → system → light.
  const cycleTheme = useCallback(() => {
    setPreference((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'));
  }, [setPreference]);

  return useMemo(
    () => ({ preference, resolvedTheme, setPreference, cycleTheme }),
    [preference, resolvedTheme, setPreference, cycleTheme],
  );
}
