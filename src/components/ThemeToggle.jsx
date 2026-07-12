import { memo } from 'react';
import { Moon, Sun, MonitorSmartphone } from 'lucide-react';

const CONFIG = {
  light: { Icon: Sun, label: 'Hell' },
  dark: { Icon: Moon, label: 'Dunkel' },
  system: { Icon: MonitorSmartphone, label: 'System' },
};

/** Manueller Umschalter: zyklisch Hell → Dunkel → System. */
function ThemeToggle({ preference, onCycle }) {
  const { Icon, label } = CONFIG[preference];
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onCycle}
      aria-label={`Farbschema: ${label}. Klicken zum Wechseln.`}
      title="Farbschema wechseln"
    >
      <Icon size={16} aria-hidden="true" />
      <span className="theme-toggle__label">{label}</span>
    </button>
  );
}

export default memo(ThemeToggle);
