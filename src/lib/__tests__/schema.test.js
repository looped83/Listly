import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  runMigrations,
  sanitizeItems,
  sanitizeFavorites,
  sanitizeHistory,
  sanitizeCards,
  sanitizeTheme,
} from '../schema';
import { STORAGE_KEYS } from '../storage';

// In-Memory-Storage-Mock (localStorage-kompatibel) – injizierbar in runMigrations,
// damit die Tests deterministisch und unabhängig von globalem State laufen.
function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    dump: () => Object.fromEntries(store),
    keys: () => [...store.keys()],
  };
}

const seed = (data) => {
  const initial = {};
  for (const [name, value] of Object.entries(data)) {
    initial[STORAGE_KEYS[name]] = JSON.stringify(value);
  }
  return createStorage(initial);
};

const read = (storage, name) => {
  const raw = storage.getItem(STORAGE_KEYS[name]);
  return raw === null ? null : JSON.parse(raw);
};

// ── Pflicht-Szenarien der Migrationspipeline ─────────────────────────────────

describe('runMigrations – leerer Speicher (frische Installation)', () => {
  it('setzt nur die Versionsmarke und materialisiert keine leeren Datenkeys', () => {
    const storage = createStorage();
    const result = runMigrations(storage);

    expect(result.status).toBe('ok');
    expect(read(storage, 'schemaVersion')).toBe(SCHEMA_VERSION);
    expect(storage.keys()).toEqual([STORAGE_KEYS.schemaVersion]);
    // Keine Migration nötig – Startversion == Zielversion.
    expect(result.applied).toEqual([]);
  });
});

describe('runMigrations – gültige Altdaten ohne Versions-Key', () => {
  it('behält alle Daten und stempelt Version 1', () => {
    const items = [
      { id: 'a', name: 'Apfel', category: 'obst', checked: false, createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const favorites = ['Hafermilch', 'Tofu'];
    const history = { apfel: { name: 'Apfel', category: 'obst', count: 3, lastPurchased: 100 } };
    const storage = seed({ items, favorites, history });

    const result = runMigrations(storage);

    expect(result.status).toBe('ok');
    expect(result.from).toBe(0); // Altdaten → als Version 0 erkannt
    expect(result.applied).toEqual([1]); // v0 → v1 genau einmal angewandt
    expect(read(storage, 'items')).toEqual(items);
    expect(read(storage, 'favorites')).toEqual(favorites);
    expect(read(storage, 'history')).toEqual(history);
    expect(read(storage, 'schemaVersion')).toBe(1);
  });
});

describe('runMigrations – teilweise beschädigte Daten', () => {
  it('setzt nur die betroffene Domäne zurück, andere bleiben unberührt', () => {
    const storage = createStorage({
      [STORAGE_KEYS.items]: 'not valid json {{{', // defektes JSON
      [STORAGE_KEYS.favorites]: JSON.stringify(['Hafermilch', 'Tofu']), // gültig
      [STORAGE_KEYS.history]: JSON.stringify({
        apfel: { name: 'Apfel', category: null, count: 2, lastPurchased: 5 },
      }),
    });

    runMigrations(storage);

    expect(read(storage, 'items')).toEqual([]); // isolierter Fallback
    expect(read(storage, 'favorites')).toEqual(['Hafermilch', 'Tofu']); // intakt
    expect(read(storage, 'history')).toEqual({
      apfel: { name: 'Apfel', category: null, count: 2, lastPurchased: 5 },
    });
    expect(read(storage, 'schemaVersion')).toBe(1);
  });

  it('verwirft nur defekte Einzeleinträge einer Liste und erhält den Rest inkl. Zusatzfelder', () => {
    const storage = seed({
      items: [
        { id: 'a', name: 'Apfel', category: 'obst', checked: false },
        { id: 'b' }, // kein name → verworfen
        'garbage', // kein Objekt → verworfen
        { name: 'Tofu', checked: 1, extra: 'behalten' }, // keine id/category, extra-Feld
      ],
    });

    runMigrations(storage);
    const items = read(storage, 'items');

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ id: 'a', name: 'Apfel', category: 'obst', checked: false });
    expect(items[1].name).toBe('Tofu');
    expect(items[1].checked).toBe(true); // koerziert
    expect(items[1].category).toBeNull(); // fehlend → null
    expect(items[1].extra).toBe('behalten'); // unbekanntes Feld erhalten
    expect(typeof items[1].id).toBe('string');
    expect(items[1].id.length).toBeGreaterThan(0); // id generiert
  });

  it('behält Kundenkarten vollständig inkl. optionalem number-Feld (reine Durchreiche)', () => {
    const cards = [
      { id: 'c1', retailer: 'lidl', name: 'Lidl', code: 'ABC123', codeType: 'qr', number: '4711' },
      { id: 'c2', retailer: 'custom', name: 'Ohne Code', number: '9999' }, // nur number, kein code
    ];
    const storage = seed({ cards: [...cards, 'garbage'] });

    runMigrations(storage);
    const stored = read(storage, 'cards');

    expect(stored).toHaveLength(2); // 'garbage' verworfen
    expect(stored[0]).toEqual(cards[0]); // alle Felder unverändert
    expect(stored[1]).toEqual(cards[1]); // number erhalten, kein code erfunden
  });
});

describe('runMigrations – mehrfaches Ausführen (idempotent)', () => {
  it('wendet dieselbe Migration nicht doppelt an und lässt den Speicher stabil', () => {
    const storage = seed({
      items: [{ id: 'a', name: 'Apfel', category: 'obst', checked: false }],
      favorites: ['Tofu'],
      history: { apfel: { name: 'Apfel', category: 'obst', count: 1, lastPurchased: 1 } },
    });

    const first = runMigrations(storage);
    const afterFirst = storage.dump();

    const second = runMigrations(storage);
    const afterSecond = storage.dump();

    expect(first.applied).toEqual([1]);
    expect(second.status).toBe('ok');
    expect(second.applied).toEqual([]); // keine erneute Migration
    expect(afterSecond).toEqual(afterFirst); // Speicher unverändert
  });
});

describe('runMigrations – zukünftige unbekannte Versionsnummer', () => {
  it('lässt Daten und Versionsmarke unangetastet (kein Downgrade)', () => {
    const storage = seed({
      schemaVersion: 999,
      items: [{ id: 'a', name: 'Apfel', category: 'obst', checked: false }],
    });
    const before = storage.dump();

    const result = runMigrations(storage);

    expect(result.status).toBe('future');
    expect(storage.dump()).toEqual(before); // nichts geändert
  });
});

describe('runMigrations – bereits aktuelle Version', () => {
  it('führt keine Migration aus und behält gültige Daten', () => {
    const storage = seed({
      schemaVersion: SCHEMA_VERSION,
      favorites: ['Hafermilch'],
    });

    const result = runMigrations(storage);

    expect(result.applied).toEqual([]);
    expect(read(storage, 'favorites')).toEqual(['Hafermilch']);
  });
});

describe('runMigrations – Theme (historisch, ungenutzt)', () => {
  it('behält einen gültigen String', () => {
    const storage = seed({ theme: 'dark' });
    runMigrations(storage);
    expect(read(storage, 'theme')).toBe('dark');
  });

  it('entfernt eine beschädigte (nicht als String parsebare) Theme-Marke', () => {
    const storage = createStorage({ [STORAGE_KEYS.theme]: 'dark' }); // ungültiges JSON
    runMigrations(storage);
    expect(storage.getItem(STORAGE_KEYS.theme)).toBeNull();
  });
});

describe('runMigrations – ohne verfügbaren Speicher', () => {
  it('wird sauber übersprungen', () => {
    expect(runMigrations(null).status).toBe('skipped-no-storage');
  });
});

describe('runMigrations – Standard-Pfad über globales localStorage (wie main.jsx)', () => {
  it('migriert vorhandenes localStorage ohne Argument', () => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(['Hafermilch']));

    const result = runMigrations(); // kein Argument → globales localStorage

    expect(result.status).toBe('ok');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.schemaVersion))).toBe(SCHEMA_VERSION);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites))).toEqual(['Hafermilch']);
    localStorage.clear();
  });
});

// ── Sanitizer als reine Einheiten ────────────────────────────────────────────

describe('sanitizeItems', () => {
  it('gibt bei Nicht-Array den leeren Fallback zurück', () => {
    expect(sanitizeItems({ foo: 1 })).toEqual([]);
    expect(sanitizeItems(null)).toEqual([]);
    expect(sanitizeItems('x')).toEqual([]);
  });

  it('verwirft Einträge ohne verwertbaren Namen', () => {
    expect(sanitizeItems([{ id: 'a' }, { name: '   ' }, { name: 5 }])).toEqual([]);
  });

  it('erhält unbekannte Zusatzfelder und koerziert bekannte', () => {
    const [item] = sanitizeItems([{ id: 'a', name: 'Apfel', checked: 'yes', foo: 'bar' }]);
    expect(item.foo).toBe('bar');
    expect(item.checked).toBe(true);
    expect(item.category).toBeNull();
  });
});

describe('sanitizeFavorites', () => {
  it('behält nur Strings', () => {
    expect(sanitizeFavorites(['a', 5, 'b', null, {}])).toEqual(['a', 'b']);
  });
  it('gibt bei Nicht-Array []', () => {
    expect(sanitizeFavorites({})).toEqual([]);
  });
});

describe('sanitizeHistory', () => {
  it('gibt bei Nicht-Objekt/Array {}', () => {
    expect(sanitizeHistory([])).toEqual({});
    expect(sanitizeHistory(null)).toEqual({});
  });

  it('verwirft Nicht-Objekt-Einträge und koerziert count/lastPurchased', () => {
    const result = sanitizeHistory({
      apfel: { name: 'Apfel', count: 'x', lastPurchased: null, note: 'keep' },
      broken: 5,
    });
    expect(result.broken).toBeUndefined();
    expect(result.apfel).toEqual({
      name: 'Apfel',
      category: null,
      count: 0,
      lastPurchased: 0,
      note: 'keep',
    });
  });
});

describe('sanitizeCards', () => {
  it('behält Objekt-Karten unverändert, verwirft Nicht-Objekte', () => {
    const cards = [{ id: '1', code: 'X', number: '9' }, 'x', 42, null];
    expect(sanitizeCards(cards)).toEqual([{ id: '1', code: 'X', number: '9' }]);
  });
  it('gibt bei Nicht-Array []', () => {
    expect(sanitizeCards('nope')).toEqual([]);
  });
});

describe('sanitizeTheme', () => {
  it('behält Strings, sonst undefined', () => {
    expect(sanitizeTheme('dark')).toBe('dark');
    expect(sanitizeTheme(5)).toBeUndefined();
    expect(sanitizeTheme(undefined)).toBeUndefined();
  });
});
