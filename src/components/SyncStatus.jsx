import { memo, useEffect, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';

// Wie lange das Icon nach einem Wechsel zu lokal/offline sichtbar bleibt,
// bevor es von selbst wieder verblasst.
const VISIBLE_MS = 3000;

// Nur die beiden „auffälligen“ Zustände zeigen überhaupt etwas – bei live/
// verbinde (dem Normalfall) bleibt der Header ganz ruhig.
const CONFIG = {
  error: { Icon: CloudOff, tone: 'error', title: 'Keine Verbindung – Änderungen werden nicht geteilt' },
  local: { Icon: Cloud, tone: 'local', title: 'Nur auf diesem Gerät gespeichert (keine geteilte Liste eingerichtet)' },
};

/**
 * Dezenter Sync-Hinweis hinter dem Titel: blitzt kurz auf, sobald die Liste
 * NICHT live synchronisiert wird (lokal oder offline – auch schon beim
 * ersten Laden, falls der Status dann bereits so ist), und verblasst danach
 * von selbst. Bleibt per Hover/Fokus weiter abrufbar (Tooltip + Fokusring),
 * auch nachdem es verblasst ist.
 */
function SyncStatus({ status }) {
  // Bei Statuswechsel während des Renderns auf „sichtbar“ zurücksetzen (statt
  // in einem Effekt) – die von React empfohlene Variante, um State an eine
  // geänderte Prop anzupassen, ohne einen zusätzlichen Render-Durchlauf
  // auszulösen.
  const [prevStatus, setPrevStatus] = useState(status);
  const [visible, setVisible] = useState(true);
  if (status !== prevStatus) {
    setPrevStatus(status);
    setVisible(true);
  }

  // Verblassen nach VISIBLE_MS: reiner Zeitgeber-Seiteneffekt, daher im Effekt
  // (setzt visible nur asynchron im Timeout-Callback, nicht synchron im
  // Effekt-Körper).
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const entry = CONFIG[status];
  if (!entry) return null; // live/verbinde: kein Hinweis nötig

  const { Icon, tone, title } = entry;
  return (
    <span
      className="header-sync"
      data-tone={tone}
      data-visible={visible}
      title={title}
      aria-label={title}
      tabIndex={0}
    >
      <Icon size={14} aria-hidden="true" />
    </span>
  );
}

export default memo(SyncStatus);
