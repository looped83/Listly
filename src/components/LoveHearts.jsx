import { memo, useEffect, useState } from 'react';

// Wie lange die Herzen sichtbar sind, bevor sie sich selbst aufräumen.
const DURATION_MS = 2200;

// Zufällige Streuung je Herz – einmalig beim Mounten berechnet (nicht im Render).
const createHearts = (count) =>
  Array.from({ length: count }, () => ({
    left: `${6 + Math.random() * 88}%`,
    delay: `${Math.random() * 0.6}s`,
    size: `${1 + Math.random() * 1.3}rem`,
  }));

/**
 * Kurze, rein dekorative Herz-Animation (Easter Egg). Ein paar 💚 schweben auf
 * und blenden aus, danach ruft die Komponente `onDone` und wird entfernt.
 *
 * `aria-hidden` + `pointer-events: none` (im CSS): rein visuell, ohne die
 * Bedienung oder Screenreader zu stören. Bei `prefers-reduced-motion` blendet
 * das CSS die Herzen aus – der Aufrufer zeigt in dem Fall stattdessen eine
 * liebevolle Textmeldung.
 *
 * @param {{ count?: number, onDone: () => void }} props
 */
function LoveHearts({ count = 3, onDone }) {
  const [hearts] = useState(() => createHearts(count));

  useEffect(() => {
    const timer = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="love-hearts" aria-hidden="true">
      {hearts.map((heart, i) => (
        <span
          key={i}
          className="love-hearts__heart"
          style={{ left: heart.left, animationDelay: heart.delay, fontSize: heart.size }}
        >
          💚
        </span>
      ))}
    </div>
  );
}

export default memo(LoveHearts);
