import { Link } from 'react-router-dom';
import { ThemeToggle } from '../ui/ThemeToggle';
import { GandalfMark } from '../ui/GandalfMark';
import { useProviderBadge } from '../../lib/ProviderBadgeContext';
import { useProfile } from '../../lib/ProfileContext';

export function TopBar() {
  const { settings } = useProviderBadge();
  const { profile } = useProfile();

  const initials =
    profile?.display_name
      ?.trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  return (
    <div className="chrome-glass sticky top-0 z-10 flex items-center justify-between border-b border-border-soft px-7 py-3.5">
      <Link to="/dashboard" className="flex items-center gap-2.5 text-[18px] font-bold tracking-tight">
        <span className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border-soft bg-panel-2">
          <GandalfMark size={30} />
        </span>
        Gandalf
      </Link>
      <div className="flex items-center gap-3">
        {settings?.badgeLabel && (
          <div className="flex items-center gap-2 rounded-full border border-border-soft bg-panel-2 py-1.5 pl-2.5 pr-3.5 text-[12.5px] font-medium text-text-muted">
            <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full" style={{ background: 'var(--good)' }} />
            {settings.badgeLabel}
          </div>
        )}
        <ThemeToggle />
        <Link
          to="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-panel-3 text-[12.5px] font-semibold text-text-muted"
          title="Profile / Settings"
        >
          {initials}
        </Link>
      </div>
    </div>
  );
}
