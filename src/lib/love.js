// ─────────────────────────────────────────────────────────────────────────────
//  Kleine, liebevolle Botschaften – ein paar versteckte Easter Eggs, die beim
//  Einkaufen auftauchen. Bewusst reiner, seiteneffektfreier Text (leicht zu
//  ergänzen/anzupassen). Von ihr an ihn. 💚
// ─────────────────────────────────────────────────────────────────────────────

/** Erscheint beim Abschluss eines Einkaufs (rotierend, zufällig gewählt). */
export const CHECKOUT_MESSAGES = [
  'Danke, dass du einkaufst 💚',
  'Ich liebe dich 💚',
  'Du bist mein Lieblingsmensch 💚',
  'Danke fürs Einkaufen – ich hab dich lieb 💚',
  'Du machst mir das Leben schöner 💚',
  'Was hab ich dich lieb 💚',
];

/** Kurze Liebesbotschaften für das Herz beim Abhaken und das Logo-Geheimnis. */
export const LOVE_MESSAGES = [
  'Ich liebe dich 💚',
  'Ich hab dich lieb 💚',
  'Du bist der Beste 💚',
  'Danke, dass es dich gibt 💚',
  'Mein Herz gehört dir 💚',
];

/** Zufälliges Element einer nicht-leeren Liste. */
export function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
