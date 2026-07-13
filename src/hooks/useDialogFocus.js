import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Sichtbare, fokussierbare Elemente innerhalb eines Containers. */
export const getFocusable = (root) =>
  root ? Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null) : [];

/**
 * Barrierefreiheit für modale Dialoge/Bottom-Sheets:
 *  - initialer Fokus (auf `initialFocusRef` oder dem ersten fokussierbaren Element),
 *  - Fokusfalle: Tab/Shift+Tab zirkulieren im Panel,
 *  - Escape schließt (ruft `onClose`),
 *  - Rückgabe des Fokus an das auslösende Element beim Schließen.
 *
 * @param {{ onClose?: () => void, initialFocusRef?: import('react').RefObject<HTMLElement> }} options
 * @returns {{ panelRef: import('react').RefObject<HTMLElement>, onKeyDown: (e: KeyboardEvent) => void }}
 */
export function useDialogFocus({ onClose, initialFocusRef } = {}) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const target = initialFocusRef?.current ?? getFocusable(panelRef.current)[0];
    target?.focus();

    return () => {
      // Nur zurückgeben, wenn das Element noch existiert – die auslösende
      // Schaltfläche kann nach der Aktion aus dem DOM verschwunden sein.
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
    // Nur beim Mount/Unmount – bewusst ohne Abhängigkeiten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return { panelRef, onKeyDown };
}
