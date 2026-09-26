import { memo, useEffect, useState } from 'react';
import { Cloud, CloudOff, CloudUpload } from 'lucide-react';

// Wie lange das Icon nach einem Wechsel zu lokal/offline sichtbar bleibt,
// bevor es von selbst wieder verblasst.
const VISIBLE_MS = 3000;

// Nur die „auffälligen“ Zustände zeigen überhaupt etwas – bei live/verbinde
// (dem Normalfall) bleibt der Header ganz ruhig.
const CONFIG = {
  error: { Icon: CloudOff, tone: 'error', title: 'Keine Verbindung – Änderungen werden nicht geteilt' },
  local: { Icon: Cloud, tone: 'local', title: 'Nur auf diesem Gerät gespeichert (keine geteilte Liste eingerichtet)' },
};

/** Eigene Änderungen, die noch nicht beim Server angekommen sind. */
const pendingEntry = (count) => ({
  Icon: CloudUpload,
  tone: 'pending',
  title:
    count === 1
      ? '1 Änderung noch nicht geteilt – wird gesendet, sobald die Verbindung steht'
      : `${count} Änderungen noch nicht geteilt – werden gesendet, sobald die Verbindung steht`,
});

/**
 * Dezenter Sync-Hinweis hinter dem Titel: blitzt kurz auf, sobald die Liste
 * NICHT live synchronisiert wird (lokal oder offline – auch schon beim
 * ersten Laden, falls der Status dann bereits so ist), und verblasst danach
 * von selbst. Bleibt per Hover/Fokus weiter abrufbar (Tooltip + Fokusring),
 * auch nachdem es verblasst ist.
 *
 * Ausnahme: Solange eigene Änderungen noch ausstehen (`pending` > 0), bleibt
 * ein Upload-Icon dauerhaft sichtbar – das ist handlungsrelevant (z. B. nicht
 * mit ausstehenden Häkchen das Handy wechseln) und verschwindet von selbst,
 * sobald alles gesendet ist.
 */
function SyncStatus({ status, pending = 0 }) {
  const mode = pending > 0 ? 'pending' : status;
  const entry = pending > 0 ? pendingEntry(pending) : CONFIG[status];

  // Bei Moduswechsel während des Renderns auf „sichtbar“ zurücksetzen (statt
  // in einem Effekt) – die von React empfohlene Variante, um State an eine
  // geänderte Prop anzupassen, ohne einen zusätzlichen Render-Durchlauf
  // auszulösen. Bei live/verbinde (kein `entry`) lohnt sich das nicht – da
  // wird ohnehin nichts gerendert.
  const [prevMode, setPrevMode] = useState(mode);
  const [visible, setVisible] = useState(true);
  if (mode !== prevMode) {
    setPrevMode(mode);
    if (entry) setVisible(true);
  }

  // Verblassen nach VISIBLE_MS: reiner Zeitgeber-Seiteneffekt, daher im Effekt
  // (setzt visible nur asynchron im Timeout-Callback, nicht synchron im
  // Effekt-Körper). Ohne `entry` (live/verbinde) oder bei ausstehenden
  // Änderungen (dauerhaft sichtbar) erübrigt sich der Timer.
  const fades = Boolean(entry) && mode !== 'pending';
  useEffect(() => {
    if (!fades) return undefined;
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [mode, fades]);

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
