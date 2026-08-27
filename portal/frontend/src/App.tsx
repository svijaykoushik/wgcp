import { useState, useEffect } from 'react';
import { InputProvider } from './contexts/InputContext';
import { useGamepad } from './hooks/useGamepad';
import { useViewTransition } from './hooks/useViewTransition';
import { useSpatialNav } from './hooks/useSpatialNav';
import { LoginView } from './views/LoginView';
import { LibraryView } from './views/LibraryView';
import { CatalogueView } from './views/CatalogueView';
import { LauncherView } from './views/LauncherView';
import { NavBar } from './components/NavBar';
import { InputPrompts } from './components/InputPrompts';
import { SkeletonCard } from './components/SkeletonCard';
import { Game, User } from './types';

function parseRegistryV2(data: any): Game[] {
  if (!data) return [];
  const gamesObj = data.games || {};
  
  if (Array.isArray(gamesObj)) {
    return gamesObj;
  }
  
  const userLocale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  
  const getLocalized = (field: any, locale: string): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object') {
      if (field[locale]) return field[locale];
      const baseLang = locale.split('-')[0];
      if (field[baseLang]) return field[baseLang];
      if (field['en-US']) return field['en-US'];
      if (field['en']) return field['en'];
      const keys = Object.keys(field);
      if (keys.length > 0) return field[keys[0]];
    }
    return String(field);
  };
  
  return Object.entries(gamesObj).map(([id, gameVal]: [string, any]) => {
    const meta = gameVal.metadata || {};
    
    let developer = '';
    if (meta.developer) {
      if (typeof meta.developer === 'string') {
        developer = meta.developer;
      } else if (meta.developer.name) {
        developer = meta.developer.name;
      }
    }
    
    let genre = '';
    if (meta.categories && Array.isArray(meta.categories)) {
      genre = meta.categories.join(' / ');
    } else if (meta.genre) {
      genre = meta.genre;
    }
    
    const iconField = meta.graphics?.icon || meta.icon;
    const icon = getLocalized(iconField, userLocale) || '🎮';
    
    const nameField = meta.name || gameVal.name;
    const name = getLocalized(nameField, userLocale) || id;
    
    const descField = meta.description || meta.summary;
    const description = getLocalized(descField, userLocale);
    
    let activeRelease: any = null;
    const releases = gameVal.releases || {};
    const releaseEntries = Object.entries(releases);
    if (releaseEntries.length > 0) {
      const stableReleases = releaseEntries
        .filter(([_, rel]: [string, any]) => 
          Array.isArray(rel.releaseChannels) && rel.releaseChannels.includes('stable')
        )
        .map(([_, rel]) => rel);

      if (stableReleases.length > 0) {
        // Sort by 'added' timestamp descending to get the latest release
        stableReleases.sort((a: any, b: any) => (b.added || 0) - (a.added || 0));
        activeRelease = stableReleases[0];
      } else {
        activeRelease = releaseEntries[0][1];
      }
    }
    
    const hosting = activeRelease?.hosting || gameVal.hosting || {};
    const runtime = activeRelease?.runtime || gameVal.runtime || {};
    
    return {
      id,
      name,
      url: gameVal.url,
      hosting: {
        hostname: hosting.hostname,
        capabilities: Array.isArray(hosting.capabilities) ? hosting.capabilities : undefined
      },
      runtime: {
        service: runtime.service,
        port: runtime.port
      },
      metadata: {
        description,
        developer,
        genre,
        license: meta.license,
        multiplayer: meta.multiplayer,
        icon
      }
    };
  });
}

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
          games = parseRegistryV2(data);
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

  // Bind the global spatial navigation key listeners
  useSpatialNav({ enabled: !activeGame });

  // Handle focus updates on view change or data load completion to prevent focus loss
  useEffect(() => {
    if (!user || activeGame || catalogLoading) return;
    
    // Give DOM a frame to render
    const frame = requestAnimationFrame(() => {
      const focusables = document.querySelectorAll('[data-focusable]');
      if (focusables.length > 0) {
        // Prefer content focusable elements first (play/add/browse actions), then headers
        const contentEl = Array.from(focusables).find((el) => {
          const id = el.getAttribute('data-focusable') || '';
          return !id.startsWith('nav-');
        }) as HTMLElement;

        const target = contentEl || (focusables[0] as HTMLElement);
        target?.focus();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [currentView, user, activeGame, catalogLoading]);

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
            />
          ) : (
            <CatalogueView
              games={registry}
              libraryIds={libraryIds}
              onAdd={addToLibrary}
              onRemove={removeFromLibrary}
              onBackToLibrary={() => handleViewChange('library')}
            />
          )}
        </main>

        <InputPrompts />
      </div>
    </InputProvider>
  );
}
