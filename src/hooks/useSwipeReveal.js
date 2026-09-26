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
 * (CSS-Property `--swipe-progress` am Element mit `backdropProps`), als
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
 * zurück, damit die Zeilen-Komponente rein präsentational bleibt. Ausschlag,
 * Fortschritt und Animation werden direkt am DOM gesetzt (über die Refs in den
 * Bündeln) – React rendert nur, wenn sich „aufgedeckt“ ändert.
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
  const [revealed, setRevealed] = useState(false);
  const rowRef = useRef(null);
  const actionsRef = useRef(null);
  const backdropRef = useRef(null);

  // Ausschlag und Grün→Rot-Fortschritt direkt am DOM setzen statt über React-
  // State: während der Geste passiert das bei jeder Fingerbewegung – so löst
  // Wischen keinen Re-Render pro Frame aus (flüssiger auf schwachen Geräten).
  // Der Fortschritt folgt aus dem Ausschlag: bis `revealWidth` bleibt er 0
  // (normales Aufdecken sieht unverändert grün aus), danach wächst er linear
  // bis zur Lösch-Schwelle.
  const applyOffset = useCallback(
    (value) => {
      dxRef.current = value;
      if (rowRef.current) rowRef.current.style.transform = value ? `translateX(${value}px)` : '';
      const span = rowWidthRef.current * deleteThresholdRatio - revealWidth;
      const past = Math.abs(value) - revealWidth;
      const progress = span > 0 ? Math.min(1, Math.max(0, past / span)) : 0;
      backdropRef.current?.style.setProperty('--swipe-progress', String(progress));
    },
    [revealWidth, deleteThresholdRatio],
  );

  // Übergangs-Animation an/aus (CSS: `.list-item[data-animating='true']`) –
  // aus demselben Grund direkt am DOM: beim Anfassen aus, beim Loslassen an.
  const setAnimating = useCallback((on) => {
    if (rowRef.current) rowRef.current.dataset.animating = String(on);
  }, []);

  const close = useCallback(() => {
    setRevealed(false);
    applyOffset(0);
  }, [applyOffset]);

  const open = useCallback(() => {
    setRevealed(true);
    applyOffset(-revealWidth);
  }, [applyOffset, revealWidth]);

  // Sanft (animiert) schließen – nach Aktion, Klick außerhalb oder Fokusverlust.
  const animateClose = useCallback(() => {
    setAnimating(true);
    close();
  }, [close, setAnimating]);

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
    [revealed, revealWidth, setAnimating],
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
      applyOffset(Math.min(0, Math.max(base + dX, -maxDrag)));
    },
    [revealed, revealWidth, applyOffset],
  );

  const onTouchEnd = useCallback(() => {
    if (!dragging.current && !horizontal.current) return;
    dragging.current = false;
    horizontal.current = false;
    setAnimating(true);

    const deleteThreshold = rowWidthRef.current * deleteThresholdRatio;
    // Entschlossen genug gewischt → Artikel direkt entfernen (Zeile gleitet
    // vollständig hinaus, danach erst der eigentliche Entfernen-Callback).
    if (deleteThreshold > 0 && Math.abs(dxRef.current) >= deleteThreshold) {
      applyOffset(-rowWidthRef.current);
      deleteTimerRef.current = setTimeout(() => onDelete?.(), DELETE_ANIMATION_MS);
      return;
    }

    // Weit genug aufgedeckt → einrasten, sonst zurückgleiten.
    if (dxRef.current <= -openThreshold) open();
    else close();
  }, [deleteThresholdRatio, openThreshold, open, close, onDelete, applyOffset, setAnimating]);

  const onActionsFocus = useCallback(() => {
    setAnimating(true);
    open();
  }, [open, setAnimating]);

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
      'data-revealed': revealed,
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
      ref: backdropRef,
    },
    closeAfterAction: animateClose,
  };
}
