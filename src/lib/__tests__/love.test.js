import { describe, expect, it } from 'vitest';
import { CHECKOUT_MESSAGES, LOVE_MESSAGES, randomFrom } from '../love';

describe('love (Easter-Egg-Botschaften)', () => {
  it('enthält nicht-leere Botschaftslisten mit Herz-Emoji', () => {
    for (const list of [CHECKOUT_MESSAGES, LOVE_MESSAGES]) {
      expect(list.length).toBeGreaterThan(0);
      for (const message of list) {
        expect(typeof message).toBe('string');
        expect(message).toContain('💚');
      }
    }
  });

  it('randomFrom liefert stets ein Element der Liste', () => {
    const list = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i += 1) {
      expect(list).toContain(randomFrom(list));
    }
  });
});
