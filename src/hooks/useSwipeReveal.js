import { useCallback, useEffect, useRef, useState } from 'react';

// Dauer der Lösch-Animation (Zeile gleitet vollständig hinaus), bevor der
// eigentliche Entfernen-Callback läuft – an die CSS-Transition angeglichen
// (siehe `.list-item[data-animating='true']`, 0.2s).
const DELETE_ANIMATION_MS = 200;

/**
 * Wisch-Geste „von rechts nach links aufdecken": ein Element (die Zeile) gleitet
 * nach links und gibt eine dahinterliegende Aktionsleiste frei.
 *
 * Ein weiterer, entschlossener Wisch über die Aktionsleiste hinaus (bis nahe an
 * die volle Zeilenbreite, `deleteThresholdRatio`) entfernt den Artikel direkt –
 * der freigelegte Hintergrund färbt sich dabei stufenlos von Grün nach Rot
 * (`progress`, als CSS-Property `--swipe-progress` auf `backdropProps`), als
 * Vorschau, ob Loslassen jetzt löschen würde.
 *
 * Die Geste ist bewusst **nicht** die einzige Bedienung: erhält ein Element in
 * der Aktionsleiste den Fokus, klappt sie automatisch auf (Tastatur/Screenreader),
 * verlässt der Fokus sie, schließt sie wieder. Zusätzlich schließt ein Klick
 * außerhalb. Der Lösch-Wisch ist eine reine Touch-Abkürzung – der Löschen-Button
 * in der Aktionsleiste bleibt unverändert per Tastatur/Screenreader erreichbar.
 *
 * Kapselt den kompletten Gesten-Zustand (Ausschlag, aufgedeckt, Animation) samt
 * Touch-Handlern und liefert fertige Prop-Bündel für die beteiligten Elemente
 * zurück, damit die Zeilen-Komponente rein präsentational bleibt.
 *
 * @param {{
 *   revealWidth: number,
 *   openThreshold: number,
 *   deleteThresholdRatio?: number,
 *   onDelete?: () => void,
 * }} options
 *   `revealWidth`  Breite der Aktionsleiste (Ausschlag beim normalen Aufdecken).
 *   `openThreshold` Ausschlag (px), ab dem beim Loslassen eingerastet wird.
 *   `deleteThresholdRatio` Anteil der Zeilenbreite, ab dem ein Loslassen löscht
 *     (Standard 0,72 – ein entschlossener, nahezu vollständiger Wisch).
 *   `onDelete` wird nach der Lösch-Animation aufgerufen (z. B. `() => onRemove(item.id)`).
 * @returns {{
 *   revealed: boolean,
 *   rowProps: object,          // auf das gleitende Element spreaden
 *   actionsProps: object,      // auf die Aktionsleiste spreaden
 *   backdropProps: object,     // auf den Hintergrund dahinter spreaden (Grün→Rot)
 *   closeAfterAction: () => void, // nach einer ausgelösten Aktion aufrufen
 * }}
 */
export function useSwipeReveal({
  revealWidth,
  openThreshold,
  deleteThresholdRatio = 0.72,
  onDelete,
}) {
  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const horizontal = useRef(false);
  const dxRef = useRef(0); // aktueller Ausschlag – unabhängig vom Render-Timing
  const rowWidthRef = useRef(0);
  const deleteTimerRef = useRef(null);
  const [dx, setDx] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1, Fortschritt Richtung Löschen
  const [animating, setAnimating] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const rowRef = useRef(null);
  const actionsRef = useRef(null);

  const setOffset = useCallback((value) => {
    dxRef.current = value;
    setDx(value);
  }, []);

  // Grün→Rot-Fortschritt: bleibt bis `revealWidth` bei 0 (normales Aufdecken
  // sieht unverändert grün aus) und wächst erst danach Richtung Lösch-Schwelle.
  const updateProgress = useCallback(
    (value) => {
      const deleteThreshold = rowWidthRef.current * deleteThresholdRatio;
      const span = deleteThreshold - revealWidth;
      if (span <= 0) {
        setProgress(0);
        return;
      }
      const past = Math.abs(value) - revealWidth;
      setProgress(Math.min(1, Math.max(0, past / span)));
    },
    [revealWidth, deleteThresholdRatio],
  );

  const close = useCallback(() => {
    setRevealed(false);
    setOffset(0);
    setProgress(0);
  }, [setOffset]);

  const open = useCallback(() => {
    setRevealed(true);
    setOffset(-revealWidth);
    setProgress(0);
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

  // Lösch-Timer beim Unmount aufräumen (z. B. wenn der Artikel anderweitig
  // schon entfernt wurde, während die Animation noch lief).
  useEffect(
    () => () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    },
    [],
  );

  const onTouchStart = useCallback(
    (e) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      dragging.current = true;
      horizontal.current = false;
      setAnimating(false);
      rowWidthRef.current = rowRef.current?.getBoundingClientRect().width ?? 0;
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
      // Maximaler Ausschlag: die volle Zeilenbreite (kompletter Wisch möglich).
      const maxDrag = Math.max(revealWidth, rowWidthRef.current);
      const next = Math.min(0, Math.max(base + dX, -maxDrag));
      setOffset(next);
      updateProgress(next);
    },
    [revealed, revealWidth, setOffset, updateProgress],
  );

  const onTouchEnd = useCallback(() => {
    if (!dragging.current && !horizontal.current) return;
    dragging.current = false;
    horizontal.current = false;

    const deleteThreshold = rowWidthRef.current * deleteThresholdRatio;
    // Entschlossen genug gewischt → Artikel direkt entfernen (Zeile gleitet
    // vollständig hinaus, danach erst der eigentliche Entfernen-Callback).
    if (deleteThreshold > 0 && Math.abs(dxRef.current) >= deleteThreshold) {
      setAnimating(true);
      setOffset(-rowWidthRef.current);
      setProgress(1);
      deleteTimerRef.current = setTimeout(() => onDelete?.(), DELETE_ANIMATION_MS);
      return;
    }

    setAnimating(true);
    // Weit genug aufgedeckt → einrasten, sonst zurückgleiten.
    if (dxRef.current <= -openThreshold) open();
    else close();
  }, [deleteThresholdRatio, openThreshold, open, close, onDelete, setOffset]);

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
    backdropProps: {
      style: { '--swipe-progress': progress },
    },
    closeAfterAction: animateClose,
  };
}
