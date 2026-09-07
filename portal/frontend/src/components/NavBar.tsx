import { User } from '../types';

export type PortalViewType = 'library' | 'catalogue' | 'achievements' | 'leaderboards' | 'profile';

interface NavBarProps {
  currentView: PortalViewType;
  onViewChange: (view: PortalViewType) => void;
  user: User;
  onLogout: () => void;
}

export function NavBar({
  currentView,
  onViewChange,
  user,
  onLogout,
}: NavBarProps) {
  const navItems: Array<{ id: PortalViewType; label: string; icon: string }> = [
    { id: 'library', label: 'My Library', icon: '🎮' },
    { id: 'catalogue', label: 'All Games', icon: '🧭' },
    { id: 'achievements', label: 'Achievements', icon: '🏆' },
    { id: 'leaderboards', label: 'Leaderboards', icon: '👑' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <header className="w-full border-b border-card-border bg-bg-secondary/40 backdrop-blur-md z-40 select-none">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 self-start md:self-auto">
          <span className="text-2xl animate-pulse">🎮</span>
          <h1 className="text-xl font-black tracking-tight text-white">Arcade Portal</h1>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end overflow-x-auto pb-1 md:pb-0">
          <nav className="flex items-center gap-1 bg-bg-primary p-1 rounded-xl border border-card-border shrink-0">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                data-focusable={`nav-${item.id}`}
                onClick={() => onViewChange(item.id)}
                className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 console-focusable-subtle ${
                  currentView === item.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                    : 'text-text-muted hover:text-white border border-transparent'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="hidden sm:block h-6 w-px bg-card-border shrink-0" />

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-text-muted hidden lg:inline">@{user.username}</span>
            <button
              type="button"
              data-focusable="nav-logout"
              onClick={onLogout}
              className="px-3 py-1.5 border border-card-border hover:border-red-500/30 hover:bg-red-500/10 text-text-muted hover:text-red-300 text-xs font-semibold rounded-xl transition-all console-focusable-subtle"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
export default NavBar;
