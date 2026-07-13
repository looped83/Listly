import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wisch-Geste „von rechts nach links aufdecken": ein Element (die Zeile) gleitet
 * nach links und gibt eine dahinterliegende Aktionsleiste frei.
 *
 * Die Geste ist bewusst **nicht** die einzige Bedienung: erhält ein Element in
 * der Aktionsleiste den Fokus, klappt sie automatisch auf (Tastatur/Screenreader),
 * verlässt der Fokus sie, schließt sie wieder. Zusätzlich schließt ein Klick
 * außerhalb.
 *
 * Kapselt den kompletten Gesten-Zustand (Ausschlag, aufgedeckt, Animation) samt
 * Touch-Handlern und liefert fertige Prop-Bündel für die zwei beteiligten
 * Elemente zurück, damit die Zeilen-Komponente rein präsentational bleibt.
 *
 * @param {{ revealWidth: number, openThreshold: number }} options
 *   `revealWidth`  Breite der Aktionsleiste (maximaler Ausschlag in px).
 *   `openThreshold` Ausschlag (px), ab dem beim Loslassen eingerastet wird.
 * @returns {{
 *   revealed: boolean,
 *   rowProps: object,          // auf das gleitende Element spreaden
 *   actionsProps: object,      // auf die Aktionsleiste spreaden
 *   closeAfterAction: () => void, // nach einer ausgelösten Aktion aufrufen
 * }}
 */
export function useSwipeReveal({ revealWidth, openThreshold }) {
  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const horizontal = useRef(false);
  const dxRef = useRef(0); // aktueller Ausschlag – unabhängig vom Render-Timing
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const rowRef = useRef(null);
  const actionsRef = useRef(null);

  const setOffset = useCallback((value) => {
    dxRef.current = value;
    setDx(value);
  }, []);

  const close = useCallback(() => {
    setRevealed(false);
    setOffset(0);
  }, [setOffset]);

  const open = useCallback(() => {
    setRevealed(true);
    setOffset(-revealWidth);
  }, [setOffset, revealWidth]);

  // Sanft (animiert) schließen – nach Aktion, Klick außerhalb oder Fokusverlust.
  const animateClose = useCallback(() => {
    setAnimating(true);
    close();
  }, [close]);

  // Klick außerhalb schließt die aufgedeckte Aktionsleiste wieder.
  useEffect(() => {
    if (!revealed) return undefined;
    const onPointerDown = (e) => {
      if (!rowRef.current?.contains(e.target) && !actionsRef.current?.contains(e.target)) {
        animateClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [revealed, animateClose]);

  const onTouchStart = useCallback(
    (e) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      dragging.current = true;
      horizontal.current = false;
      setAnimating(false);
      // Beim erneuten Anfassen vom aktuellen (ggf. aufgedeckten) Offset ausgehen.
      dxRef.current = revealed ? -revealWidth : 0;
    },
    [revealed, revealWidth],
  );

  const onTouchMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      const t = e.touches[0];
      const dX = t.clientX - start.current.x;
      const dY = t.clientY - start.current.y;
      // Richtung einmal festlegen: vertikal → Scrollen zulassen, nicht wischen.
      if (!horizontal.current && Math.abs(dX) < Math.abs(dY)) {
        dragging.current = false;
        return;
      }
      horizontal.current = true;
      const base = revealed ? -revealWidth : 0;
      setOffset(Math.min(0, Math.max(base + dX, -revealWidth)));
    },
    [revealed, revealWidth, setOffset],
  );

  const onTouchEnd = useCallback(() => {
    if (!dragging.current && !horizontal.current) return;
    dragging.current = false;
    horizontal.current = false;
    setAnimating(true);
    // Weit genug aufgedeckt → einrasten, sonst zurückgleiten.
    if (dxRef.current <= -openThreshold) open();
    else close();
  }, [openThreshold, open, close]);

  const onActionsFocus = useCallback(() => {
    setAnimating(true);
    open();
  }, [open]);

  const onActionsBlur = useCallback(
    (e) => {
      // Nur schließen, wenn der Fokus die Leiste ganz verlässt.
      if (!actionsRef.current?.contains(e.relatedTarget)) animateClose();
    },
    [animateClose],
  );

  return {
    revealed,
    rowProps: {
      ref: rowRef,
      style: { transform: `translateX(${dx}px)` },
      'data-revealed': revealed,
      'data-animating': animating,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    actionsProps: {
      ref: actionsRef,
      onFocus: onActionsFocus,
      onBlur: onActionsBlur,
    },
    closeAfterAction: animateClose,
  };
}
