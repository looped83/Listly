import { memo } from 'react';
import { Cloud, CloudOff, RefreshCw, Wifi } from 'lucide-react';

const CONFIG = {
  live: { Icon: Wifi, label: 'Live', tone: 'ok', title: 'Geteilte Liste – in Echtzeit synchronisiert' },
  connecting: { Icon: RefreshCw, label: 'Verbinde…', tone: 'pending', title: 'Verbindung zur geteilten Liste wird aufgebaut' },
  error: { Icon: CloudOff, label: 'Offline', tone: 'error', title: 'Keine Verbindung – Änderungen werden nicht geteilt' },
  local: { Icon: Cloud, label: 'Lokal', tone: 'muted', title: 'Nur auf diesem Gerät gespeichert (keine geteilte Liste eingerichtet)' },
};

/** Live-Anzeige (oben rechts): zeigt, ob die Liste in Echtzeit synchronisiert wird. */
function SyncStatus({ status }) {
  const { Icon, label, tone, title } = CONFIG[status] ?? CONFIG.local;
  return (
    <span className="sync" data-tone={tone} title={title}>
      <Icon size={13} aria-hidden="true" />
      <span className="sync__label">{label}</span>
    </span>
  );
}

export default memo(SyncStatus);
