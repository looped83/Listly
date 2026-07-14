import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// Bewusst schlankes Setup: empfohlene Kernregeln + die für dieses Projekt
// wichtigsten React-Regeln (Hooks-Verträge, JSX-Verwendung). Stil/Formatierung
// bleibt Sache der Autoren – hier geht es um echte Fehlerklassen.
export default [
  { ignores: ['dist/', 'dev-dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // JSX-Bezüge zählen als Verwendung (sonst false positives bei Imports).
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off', // automatic runtime – kein React-Import nötig
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Tests laufen in Vitest (globals: true) unter jsdom + Node.
    files: ['**/__tests__/**', 'src/setupTests.js', 'src/**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },
  {
    // Build-/Konfigurationsdateien laufen unter Node.
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
