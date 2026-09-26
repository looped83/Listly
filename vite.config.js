import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// theme_color entspricht dem Papier-Look des Light Mode; im Betrieb wird die
// <meta name="theme-color"> zur Laufzeit an den aktiven Modus angepasst.
//
// `test` wird nur von Vitest gelesen (vite build/dev ignoriert unbekannte
// Felder) – eine separate vitest.config.js hätte den React-/PWA-Plugin-Setup
// duplizieren müssen.
export default defineConfig({
  // Relative Asset-Pfade: die App funktioniert am Server-Root, unter einem
  // Unterpfad und auch direkt aus dem Dateisystem geöffnet (file://).
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registrierung als Inline-Skript statt eigener registerSW.js-Datei:
      // eine Anfrage weniger, nichts Blockierendes im <head>.
      injectRegister: 'inline',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Listly',
        short_name: 'Listly',
        description: 'Vegane Einkaufsliste mit Kaufverlauf – offline nutzbar.',
        lang: 'de',
        // Relativ zum Manifest-Ort – funktioniert am Server-Root ebenso wie
        // unter einem Unterpfad (z. B. GitHub Pages: /Listly/).
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf6ee',
        theme_color: '#faf6ee',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
        // latin-ext-Schnitte (Zusatzzeichen wie ő, ł, ş) braucht deutscher Text
        // praktisch nie – der Browser lädt sie dank unicode-range nur bei
        // Bedarf. Nicht vorab cachen (spart ~170 KB je Installation); falls
        // doch gebraucht, hält runtimeCaching sie danach offline vor.
        globIgnores: ['**/*-latin-ext-*.woff2'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'listly-fonts' },
          },
        ],
        // Veraltete Precaches entfernen, damit kein alter Stand hängen bleibt.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    css: false,
  },
});
