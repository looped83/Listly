import { useEffect, useState } from 'react';

// theme-color der <meta>-Angabe je aktivem Modus (an die CSS-Tokens angelehnt).
const META_THEME_COLOR = { light: '#faf6ee', dark: '#16201b' };
const DARK_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Wendet automatisch das Farbschema der Systemeinstellung an
 * (prefers-color-scheme) und hält es reaktiv – ohne manuellen Umschalter.
 * Setzt data-theme am <html> und aktualisiert die theme-color-Meta.
 */
export function useSystemTheme() {
  const [theme, setTheme] = useState(getSystemTheme);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia(DARK_QUERY);
    const handleChange = (event) => setTheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_THEME_COLOR[theme]);
  }, [theme]);

  return theme;
}
