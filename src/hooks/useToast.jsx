import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ToastRegion from '../components/Toast';

/**
 * Zentrale Feedback-Infrastruktur (Toast/Snackbar) auf Basis von React-Context –
 * bewusst ohne globales State-Framework und ohne UI-Bibliothek.
 *
 * Verwendung:
 *   const { notify, notifyError, dismiss } = useToast();
 *   notify('Artikel gelöscht', { action: { label: 'Rückgängig', onAction } });
 *   notifyError('Speichern fehlgeschlagen');
 *
 * Jede Meldung trägt höchstens EINE klar definierte Undo-Aktion.
 */
const ToastContext = createContext(null);

let counter = 0;
const nextId = () => `toast-${(counter += 1)}`;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((toast) => {
    const id = nextId();
    setToasts((prev) => [...prev, { id, tone: 'info', ...toast }]);
    return id;
  }, []);

  // Normale Statusmeldung (aria-live: polite). Mit Undo-Aktion länger sichtbar.
  const notify = useCallback(
    (message, { tone = 'info', action, duration } = {}) =>
      show({ message, tone, action, duration: duration ?? (action ? 8000 : 5000) }),
    [show],
  );

  // Echter Fehler (aria-live: assertive). Ebenfalls länger sichtbar.
  const notifyError = useCallback(
    (message, { action, duration } = {}) =>
      show({ message, tone: 'error', action, duration: duration ?? (action ? 10000 : 6000) }),
    [show],
  );

  const value = useMemo(() => ({ notify, notifyError, dismiss }), [notify, notifyError, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast muss innerhalb eines <ToastProvider> verwendet werden.');
  return ctx;
}
