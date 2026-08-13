import { useState, useEffect } from 'react';
import { InputProvider } from './contexts/InputContext';
import { useGamepad } from './hooks/useGamepad';
import { useViewTransition } from './hooks/useViewTransition';
import { LoginView } from './views/LoginView';
import { LibraryView } from './views/LibraryView';
import { CatalogueView } from './views/CatalogueView';
import { LauncherView } from './views/LauncherView';
import { NavBar } from './components/NavBar';
import { InputPrompts } from './components/InputPrompts';
import { SkeletonCard } from './components/SkeletonCard';
import { Game, User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Navigation: 'library' | 'catalogue'
  const [currentView, setCurrentView] = useState<'library' | 'catalogue'>('library');
  
  // View transition hook
  const { startTransition, transitionClass } = useViewTransition(300);

  // Games state
  const [registry, setRegistry] = useState<Game[]>([]);
  const [libraryIds, setLibraryIds] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Launcher state
  const [activeGame, setActiveGame] = useState<Game | null>(null);

  // Spatial navigation element focus tracking
  const [focusedElementId, setFocusedElementId] = useState<string | null>(null);

  // 1. Restore user session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      } catch (err) {
        console.error('Session restoration failed:', err);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  // 2. Fetch catalogue and user's library when authenticated
  useEffect(() => {
    if (!user) return;

    async function loadData() {
      setCatalogLoading(true);
      try {
        // Fetch registry
        const regRes = await fetch('/api/registry.json');
        let games: Game[] = [];
        if (regRes.ok) {
          const data = await regRes.json();
          games = data.games || [];
          setRegistry(games);
        }

        // Fetch user's library
        const libRes = await fetch('/api/v1/library');
        if (libRes.ok) {
          const libData = await libRes.json();
          setLibraryIds(libData);
        }
      } catch (err) {
        console.error('Failed to load catalogue or library:', err);
      } finally {
        setCatalogLoading(false);
      }
    }

    loadData();
  }, [user]);

  // Bind spatial navigation input gamepad polling, disable inside launcher or when inputs are active
  const isInputActive = document.activeElement?.tagName === 'INPUT';
  useGamepad(!activeGame && !isInputActive);

  // PageUp / PageDown tab switching event handlers for bumper actions globally
  useEffect(() => {
    if (!user || activeGame) return;
    const handleBumpersGlobal = (e: KeyboardEvent) => {
      if (e.key === 'PageUp' && currentView !== 'library') {
        e.preventDefault();
        handleViewChange('library');
      } else if (e.key === 'PageDown' && currentView !== 'catalogue') {
        e.preventDefault();
        handleViewChange('catalogue');
      }
    };
    window.addEventListener('keydown', handleBumpersGlobal);
    return () => window.removeEventListener('keydown', handleBumpersGlobal);
  }, [user, activeGame, currentView]);

  // Actions
  const handleLogin = async (username: string) => {
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setCurrentView('library');
      } else {
        const data = await res.json();
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      setLoginError('Server connection error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      setUser(null);
      setLibraryIds([]);
      setRegistry([]);
      setFocusedElementId(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const addToLibrary = async (gameId: string) => {
    try {
      const res = await fetch('/api/v1/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        const libData = await res.json();
        setLibraryIds(libData);
      }
    } catch (err) {
      console.error('Failed to add to library:', err);
    }
  };

  const removeFromLibrary = async (gameId: string) => {
    try {
      const res = await fetch(`/api/v1/library/${gameId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const libData = await res.json();
        setLibraryIds(libData);
      }
    } catch (err) {
      console.error('Failed to remove from library:', err);
    }
  };

  const handleViewChange = (targetView: 'library' | 'catalogue') => {
    if (targetView === currentView) return;
    const direction = targetView === 'catalogue' ? 'right' : 'left';
    startTransition(targetView, direction, (view) => {
      setCurrentView(view as 'library' | 'catalogue');
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-primary select-none">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-xl font-bold tracking-widest text-text-muted animate-pulse">
            LOADING PLATFORM WORKSPACE
          </div>
        </div>
      </div>
    );
  }

  // Auth screen routing
  if (!user) {
    return (
      <LoginView
        onLogin={handleLogin}
        loginError={loginError}
        isLoggingIn={isLoggingIn}
      />
    );
  }

  // Launcher overlay routing
  if (activeGame) {
    return (
      <LauncherView
        game={activeGame}
        onExit={() => setActiveGame(null)}
      />
    );
  }

  const libraryGames = registry.filter((game) => libraryIds.includes(game.id));

  return (
    <InputProvider>
      <div className="flex flex-col min-h-screen">
        <NavBar
          currentView={currentView}
          onViewChange={handleViewChange}
          user={user}
          onLogout={handleLogout}
          focusedElementId={focusedElementId}
        />

        <main className={`flex-1 max-w-6xl w-full mx-auto p-6 pb-24 overscan-safe ${transitionClass}`}>
          {catalogLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} index={i} />
              ))}
            </div>
          ) : currentView === 'library' ? (
            <LibraryView
              games={libraryGames}
              onLaunch={setActiveGame}
              onRemove={removeFromLibrary}
              onNavigateToCatalogue={() => handleViewChange('catalogue')}
              focusedElementId={focusedElementId}
              setFocusedElementId={setFocusedElementId}
              isActive={!activeGame}
            />
          ) : (
            <CatalogueView
              games={registry}
              libraryIds={libraryIds}
              onAdd={addToLibrary}
              onRemove={removeFromLibrary}
              onBackToLibrary={() => handleViewChange('library')}
              focusedElementId={focusedElementId}
              setFocusedElementId={setFocusedElementId}
              isActive={!activeGame}
            />
          )}
        </main>

        <InputPrompts />
      </div>
    </InputProvider>
  );
}
