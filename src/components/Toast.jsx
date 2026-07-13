import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Undo2, X } from 'lucide-react';

const TONE_ICON = { info: Info, success: CheckCircle2, error: AlertCircle };

/**
 * Eine einzelne Snackbar mit zugänglichem Auto-Dismiss:
 *  - großzügige Anzeigedauer,
 *  - Pause bei Hover und bei Tastatur-/Fokus (onFocus/onBlur bubblen via React),
 *  - optional genau eine Undo-Aktion, per Tastatur (Tab) erreichbar.
 * Der sichtbare Text ist aria-hidden – die Ansage übernimmt die Live-Region der
 * ToastRegion, damit nichts doppelt vorgelesen wird.
 */
function ToastItem({ toast, onDismiss }) {
  const { id, message, tone, action, duration } = toast;
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const timer = useRef(null);
  const [paused, setPaused] = useState(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const run = useCallback(() => {
    clear();
    if (remaining.current <= 0) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => onDismiss(id), remaining.current);
  }, [clear, id, onDismiss]);

  const pause = useCallback(() => {
    if (timer.current) {
      remaining.current -= Date.now() - startedAt.current;
      clear();
    }
    setPaused(true);
  }, [clear]);

  const resume = useCallback(() => {
    setPaused(false);
    run();
  }, [run]);

  useEffect(() => {
    run();
    return clear;
  }, [run, clear]);

  const handleAction = useCallback(() => {
    action?.onAction();
    onDismiss(id);
  }, [action, id, onDismiss]);

  const Icon = TONE_ICON[tone] ?? Info;

  return (
    <div
      className="toast"
      data-tone={tone}
      data-paused={paused}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <Icon size={18} className="toast__icon" aria-hidden="true" />
      <span className="toast__message" aria-hidden="true">
        {message}
      </span>
      {action && (
        <button type="button" className="toast__action" onClick={handleAction}>
          <Undo2 size={15} aria-hidden="true" />
          {action.label ?? 'Rückgängig'}
        </button>
      )}
      <button
        type="button"
        className="toast__dismiss"
        onClick={() => onDismiss(id)}
        aria-label="Benachrichtigung schließen"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Text, den Screenreader vorlesen – inkl. Hinweis auf verfügbares Undo. */
const announce = (toast) =>
  toast ? `${toast.message}${toast.action ? ' Rückgängig verfügbar.' : ''}` : '';

/**
 * Sammelbehälter aller Toasts plus zwei getrennte aria-live-Regionen:
 *   - polite (role="status") für normale Statusmeldungen,
 *   - assertive (role="alert") nur für echte Fehler.
 * Angesagt wird jeweils die neueste Meldung der passenden Dringlichkeit.
 */
function ToastRegion({ toasts, onDismiss }) {
  const polite = [...toasts].reverse().find((toast) => toast.tone !== 'error');
  const assertive = [...toasts].reverse().find((toast) => toast.tone === 'error');

  return (
    <div className="toasts" role="region" aria-label="Benachrichtigungen">
      <div className="visually-hidden" role="status" aria-live="polite">
        {announce(polite)}
      </div>
      <div className="visually-hidden" role="alert" aria-live="assertive">
        {announce(assertive)}
      </div>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default memo(ToastRegion);
