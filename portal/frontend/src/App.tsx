import { useState, useEffect, useRef } from 'react';
import { Game, User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [usernameInput, setUsernameInput] = useState('testuser');
  const [loginError, setLoginError] = useState('');
  
  // Navigation: 'library' | 'catalogue'
  const [currentView, setCurrentView] = useState<'library' | 'catalogue'>('library');
  
  // Games state
  const [registry, setRegistry] = useState<Game[]>([]);
  const [libraryIds, setLibraryIds] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Launcher state
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const focusTimersRef = useRef<number[]>([]);

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

  // Handle ESC key for launcher menu
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && activeGame) {
        if (isOverlayOpen) {
          resumeGame();
        } else {
          setIsOverlayOpen(true);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGame, isOverlayOpen]);

  // Handle fullscreen change to show overlay when exiting fullscreen
  useEffect(() => {
    function handleFullscreenChange() {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (activeGame && !isFs && !isClosing && !isOverlayOpen) {
        setIsOverlayOpen(true);
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [activeGame, isClosing, isOverlayOpen]);

  // Actions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput }),
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

  // Launcher Core Mechanisms
  const resolveGameUrl = (game: Game) => {
    if (game.url) return game.url;
    if (game.hosting?.hostname) return `http://${game.hosting.hostname}`;
    return `http://${game.id}.localhost`;
  };

  const clearFocusTimers = () => {
    focusTimersRef.current.forEach((t) => clearTimeout(t));
    focusTimersRef.current = [];
  };

  const focusIframe = () => {
    const iframe = iframeRef.current;
    if (!iframe || isOverlayOpen) return;
    try {
      iframe.focus();
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
      }
    } catch (e) {
      iframe.focus();
    }
  };

  const scheduleAsyncFocus = () => {
    clearFocusTimers();
    requestAnimationFrame(() => focusIframe());
    const delays = [50, 150, 300, 600, 1200];
    delays.forEach((delay) => {
      const timer = window.setTimeout(() => focusIframe(), delay);
      focusTimersRef.current.push(timer);
    });
  };

  const launchGame = async (game: Game) => {
    setIsClosing(false);
    setActiveGame(game);
    setIsOverlayOpen(false);

    // Request Fullscreen
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen declined/unsupported', err);
    }

    // Schedule input focus on iframe
    scheduleAsyncFocus();
  };

  const resumeGame = async () => {
    setIsOverlayOpen(false);
    const isFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement
    );
    if (!isFs) {
      const el = document.documentElement;
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } catch (err) {
        console.warn('Fullscreen request failed on resume', err);
      }
    }
    scheduleAsyncFocus();
  };

  const exitGame = async () => {
    setIsClosing(true);
    clearFocusTimers();
    setActiveGame(null);
    setIsOverlayOpen(false);

    // Exit Fullscreen
    const isFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement
    );
    if (isFs) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      } catch (err) {
        console.warn('Error exiting fullscreen', err);
      }
    }
    setIsClosing(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="text-xl font-semibold text-text-muted animate-pulse">Loading platform...</div>
      </div>
    );
  }

  // 1. Login Screen
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary">
        <div className="w-full max-w-md p-8 bg-bg-secondary/80 border border-card-border rounded-3xl backdrop-blur-xl shadow-2xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-accent-purple text-xs font-semibold uppercase tracking-wider mb-6">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></span>
            Authentication Required
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-white">Arcade Portal</h1>
          <p className="text-text-muted text-sm mb-6 leading-relaxed">
            Access your secure containerized game environment.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-left text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full px-4 py-3 bg-bg-primary border border-card-border rounded-xl text-white focus:outline-none focus:border-indigo-500/80 transition-colors"
                placeholder="Enter username"
              />
            </div>
            {loginError && <p className="text-red-400 text-xs text-left">{loginError}</p>}
            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 transform active:scale-95 shadow-lg shadow-indigo-500/20"
            >
              Log In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filtered games
  const libraryGames = registry.filter((game) => libraryIds.includes(game.id));

  // 2. Full-screen Game Launcher Overlay
  if (activeGame) {
    return (
      <div className="fixed inset-0 z-[9999] w-screen h-screen bg-black overflow-hidden select-none">
        <div className="w-full h-full relative flex items-center justify-center bg-black">
          <iframe
            ref={iframeRef}
            src={resolveGameUrl(activeGame)}
            className="w-full h-full border-none bg-black block"
            allow="autoplay; fullscreen; gamepad; focus-without-user-activation; accelerometer; gyroscope; clipboard-read; clipboard-write"
            onLoad={scheduleAsyncFocus}
          />
        </div>

        {/* Floating System Menu Trigger */}
        <button
          onClick={() => setIsOverlayOpen(true)}
          className="absolute top-4 right-4 z-[10001] inline-flex items-center gap-2 bg-bg-secondary/75 border border-white/15 text-text-muted hover:text-white rounded-full px-4 py-2 text-xs font-mono transition-all duration-200 hover:bg-bg-secondary hover:border-card-hover-border hover:shadow-lg opacity-40 hover:opacity-100"
          type="button"
          title="System Menu (ESC)"
        >
          ⚙ System Menu
        </button>

        {/* Decoupled System Menu Overlay */}
        {isOverlayOpen && (
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={resumeGame}></div>
            <div className="relative bg-bg-secondary/90 border border-white/12 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl backdrop-blur-2xl animate-[overlayPop_0.25s_cubic-bezier(0.16,1,0.3,1)]">
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-gradient-to-tr from-indigo-500 to-blue-500 shadow-xl shadow-indigo-500/25">
                  {activeGame.metadata?.icon || '🎮'}
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{activeGame.name || activeGame.id}</h2>
                <span className="text-xs font-mono font-semibold uppercase px-2.5 py-1 rounded-full bg-indigo-500/15 text-accent-purple border border-indigo-500/30">
                  {activeGame.metadata?.genre || 'HTML5 Game'}
                </span>
              </div>

              <div className="space-y-3">
                <button
                  onClick={resumeGame}
                  className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95"
                >
                  ▶ Resume Game
                </button>
                <button
                  onClick={exitGame}
                  className="w-full py-3 px-4 bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 hover:border-red-500/50 hover:text-white font-semibold rounded-xl transition-all active:scale-95"
                >
                  ⏻ Exit to Library
                </button>
              </div>

              <div className="mt-6 text-xs text-text-muted font-mono">
                Press <kbd className="bg-bg-primary px-1.5 py-0.5 rounded border border-card-border text-white text-[10px]">ESC</kbd> to toggle menu
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Normal App Shell (Library or Catalogue)
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Header */}
      <header className="w-full border-b border-card-border bg-bg-secondary/40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎮</span>
            <h1 className="text-xl font-bold tracking-tight text-white">Arcade Portal</h1>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1.5 bg-bg-primary p-1 rounded-xl border border-card-border">
              <button
                onClick={() => setCurrentView('library')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  currentView === 'library'
                    ? 'bg-indigo-500/10 text-accent-purple border border-indigo-500/30'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                My Library
              </button>
              <button
                onClick={() => setCurrentView('catalogue')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  currentView === 'catalogue'
                    ? 'bg-indigo-500/10 text-accent-purple border border-indigo-500/30'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                All Games
              </button>
            </nav>

            <div className="h-6 w-px bg-card-border"></div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-text-muted">@{user.username}</span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 border border-card-border hover:border-red-500/30 hover:bg-red-500/10 text-text-muted hover:text-red-300 text-xs font-semibold rounded-xl transition-all"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        {catalogLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-lg text-text-muted animate-pulse">Loading games...</div>
          </div>
        ) : currentView === 'library' ? (
          // LIBRARY VIEW
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">My Game Library</h2>
                <p className="text-sm text-text-muted">Launch your added games directly from containerized workloads.</p>
              </div>
              {libraryGames.length > 0 && (
                <button
                  onClick={() => setCurrentView('catalogue')}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                >
                  + Add More Games
                </button>
              )}
            </div>

            {libraryGames.length === 0 ? (
              // Empty State
              <div className="flex flex-col items-center justify-center text-center p-16 border-2 border-dashed border-card-border bg-bg-secondary/20 rounded-3xl backdrop-blur-sm">
                <span className="text-5xl mb-4">👾</span>
                <h3 className="text-xl font-bold text-white mb-2">Your library is currently empty</h3>
                <p className="text-sm text-text-muted max-w-md mb-6">
                  Before you can play, browse the platform catalogue and add games to your personal library.
                </p>
                <button
                  onClick={() => setCurrentView('catalogue')}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                >
                  Browse Catalogue
                </button>
              </div>
            ) : (
              // Library Cards Grid
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {libraryGames.map((game) => {
                  const isMulti = game.metadata?.multiplayer;
                  return (
                    <div
                      key={game.id}
                      className="group flex flex-col justify-between p-6 bg-bg-secondary/70 border border-card-border rounded-2xl hover:border-card-hover-border hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold bg-gradient-to-tr from-indigo-500 to-blue-500 shadow-md">
                            {game.metadata?.icon || '🎮'}
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              isMulti
                                ? 'bg-emerald-500/10 text-accent-green border-emerald-500/30'
                                : 'bg-sky-500/10 text-accent-cyan border-sky-500/30'
                            }`}
                          >
                            {isMulti ? 'Multiplayer' : 'Singleplayer'}
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">{game.name || game.id}</h3>
                        <p className="text-sm text-text-muted line-clamp-2 mb-4 leading-relaxed h-10">
                          {game.metadata?.description || 'No description provided.'}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-6">
                          <span className="text-[10px] font-mono bg-white/5 border border-white/10 rounded-md px-2 py-0.5 text-slate-300">
                            {game.metadata?.genre || 'HTML5'}
                          </span>
                          {game.metadata?.license && (
                            <span className="text-[10px] font-mono bg-white/5 border border-white/10 rounded-md px-2 py-0.5 text-slate-300 max-w-[120px] truncate" title={game.metadata.license}>
                              {game.metadata.license}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 mt-auto">
                        <button
                          onClick={() => launchGame(game)}
                          className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md active:scale-95"
                        >
                          ▶ Play Game
                        </button>
                        <button
                          onClick={() => removeFromLibrary(game.id)}
                          className="w-full py-1.5 text-xs text-text-muted hover:text-red-400 font-semibold transition-colors"
                        >
                          Remove from Library
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // CATALOGUE VIEW
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Game Catalogue</h2>
                <p className="text-sm text-text-muted">Browse all games hosted securely on the platform registry.</p>
              </div>
              <button
                onClick={() => setCurrentView('library')}
                className="px-4 py-2 border border-card-border hover:border-indigo-500/40 text-text-main text-sm font-semibold rounded-xl transition-all active:scale-95"
              >
                Back to Library
              </button>
            </div>

            {registry.length === 0 ? (
              <div className="text-center p-12 bg-bg-secondary/40 border border-card-border rounded-3xl text-text-muted">
                No games currently registered in the platform registry.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {registry.map((game) => {
                  const inLibrary = libraryIds.includes(game.id);
                  const isMulti = game.metadata?.multiplayer;
                  return (
                    <div
                      key={game.id}
                      className="group flex flex-col justify-between p-6 bg-bg-secondary/70 border border-card-border rounded-2xl hover:border-card-hover-border hover:shadow-2xl transition-all duration-300"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold bg-gradient-to-tr from-indigo-500 to-blue-500">
                            {game.metadata?.icon || '🎮'}
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              isMulti
                                ? 'bg-emerald-500/10 text-accent-green border-emerald-500/30'
                                : 'bg-sky-500/10 text-accent-cyan border-sky-500/30'
                            }`}
                          >
                            {isMulti ? 'Multiplayer' : 'Singleplayer'}
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">{game.name || game.id}</h3>
                        <p className="text-sm text-text-muted line-clamp-2 mb-4 leading-relaxed h-10">
                          {game.metadata?.description || 'No description provided.'}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-6">
                          <span className="text-[10px] font-mono bg-white/5 border border-white/10 rounded-md px-2 py-0.5 text-slate-300">
                            {game.metadata?.genre || 'HTML5'}
                          </span>
                          {game.metadata?.license && (
                            <span className="text-[10px] font-mono bg-white/5 border border-white/10 rounded-md px-2 py-0.5 text-slate-300 max-w-[120px] truncate" title={game.metadata.license}>
                              {game.metadata.license}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-auto">
                        {inLibrary ? (
                          <div className="flex flex-col gap-2">
                            <div className="w-full text-center py-2 bg-indigo-500/10 text-accent-purple text-sm font-semibold rounded-xl border border-indigo-500/30">
                              ✓ In Library
                            </div>
                            <button
                              onClick={() => removeFromLibrary(game.id)}
                              className="w-full py-1 text-xs text-text-muted hover:text-red-400 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToLibrary(game.id)}
                            className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl transition-all shadow-md active:scale-95"
                          >
                            Add to Library
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-card-border bg-bg-secondary/20 text-center text-xs text-text-muted">
        <div>
          Central Platform Ingress &bull; Secure Per-Game Network Workload Isolation
        </div>
      </footer>
    </div>
  );
}
