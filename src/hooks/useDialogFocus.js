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
 *  - Escape schließt (ruft `onClose`) – auf Dokumentebene, damit es auch greift,
 *    wenn der Fokus das Panel verloren hat (z. B. weil das fokussierte Element
 *    nach einer Aktion aus dem DOM entfernt wurde),
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

  // Escape auf Dokumentebene: schließt zuverlässig, auch wenn der Fokus gerade
  // nicht im Panel liegt. Handler, die Escape selbst verarbeiten (z. B. der
  // Inline-Editor), stoppen die Propagation und bleiben unberührt.
  useEffect(() => {
    const onDocumentKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => document.removeEventListener('keydown', onDocumentKeyDown);
  }, [onClose]);

  const onKeyDown = useCallback(
    (e) => {
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
    [],
  );

  return { panelRef, onKeyDown };
}
