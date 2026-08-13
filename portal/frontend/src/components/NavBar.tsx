import { User } from '../types';

interface NavBarProps {
  currentView: 'library' | 'catalogue';
  onViewChange: (view: 'library' | 'catalogue') => void;
  user: User;
  onLogout: () => void;
}

export function NavBar({
  currentView,
  onViewChange,
  user,
  onLogout,
}: NavBarProps) {
  return (
    <header className="w-full border-b border-card-border bg-bg-secondary/40 backdrop-blur-md z-40 select-none">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-pulse">🎮</span>
          <h1 className="text-xl font-bold tracking-tight text-white">Arcade Portal</h1>
        </div>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1.5 bg-bg-primary p-1 rounded-xl border border-card-border">
            <button
              type="button"
              data-focusable="nav-library"
              onClick={() => onViewChange('library')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all console-focusable-subtle ${
                currentView === 'library'
                  ? 'bg-indigo-500/10 text-accent-purple border border-indigo-500/30'
                  : 'text-text-muted hover:text-white border border-transparent'
              }`}
            >
              My Library
            </button>
            <button
              type="button"
              data-focusable="nav-catalogue"
              onClick={() => onViewChange('catalogue')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all console-focusable-subtle ${
                currentView === 'catalogue'
                  ? 'bg-indigo-500/10 text-accent-purple border border-indigo-500/30'
                  : 'text-text-muted hover:text-white border border-transparent'
              }`}
            >
              All Games
            </button>
          </nav>

          <div className="h-6 w-px bg-card-border"></div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-text-muted hidden sm:inline">@{user.username}</span>
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
