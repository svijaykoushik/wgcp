import { useState, useEffect } from 'react';
import { Game, AchievementItem } from '../types';
import { getAchievementsForGame, KNOWN_GAME_ACHIEVEMENTS } from '../utils/gameServicesData';

interface AchievementsViewProps {
  games: Game[];
  onLaunchGame: (game: Game) => void;
}

export function AchievementsView({ games, onLaunchGame }: AchievementsViewProps) {
  const [selectedGameId, setSelectedGameId] = useState<string>('all');
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [allAchievements, setAllAchievements] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load achievements for all games from backend
  useEffect(() => {
    let isMounted = true;

    async function fetchAchievements() {
      setLoading(true);
      try {
        const gameIds = games.length > 0 ? games.map(g => g.id) : Object.keys(KNOWN_GAME_ACHIEVEMENTS);
        const results = await Promise.all(
          gameIds.map(async (gid) => {
            try {
              const res = await fetch(`/api/v1/games/${gid}/achievements`);
              if (res.ok) {
                const data = await res.json();
                return getAchievementsForGame(gid, data);
              }
            } catch (e) {
              console.warn(`Failed to fetch achievements for ${gid}:`, e);
            }
            return getAchievementsForGame(gid, []);
          })
        );

        if (isMounted) {
          const flattened = results.flat();
          setAllAchievements(flattened);
        }
      } catch (err) {
        console.error('Failed to load achievements:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAchievements();
    return () => { isMounted = false; };
  }, [games]);

  const displayedAchievements = allAchievements.filter(item => {
    const matchesGame = selectedGameId === 'all' || item.gameId === selectedGameId;
    if (!matchesGame) return false;
    if (filter === 'unlocked') return item.unlocked;
    if (filter === 'locked') return !item.unlocked;
    return true;
  });

  const totalCount = allAchievements.length;
  const unlockedCount = allAchievements.filter(a => a.unlocked).length;
  const unlockPercentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const getGame = (gameId: string) => games.find(g => g.id === gameId);
  const selectedGame = selectedGameId !== 'all' ? getGame(selectedGameId) : null;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-card-border bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 p-6 sm:p-8 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl">🏆</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Achievements Showcase</h2>
            </div>
            <p className="text-text-muted text-sm sm:text-base max-w-xl">
              Track your unlocked trophies, milestones, and challenges across the console catalog.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {selectedGame && (
              <button
                type="button"
                data-focusable="achieve-launch-btn"
                onClick={() => onLaunchGame(selectedGame)}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all console-focusable shrink-0"
              >
                ▶ Play {selectedGame.name || selectedGame.id}
              </button>
            )}

            {/* Aggregate Stats Card */}
            <div className="bg-bg-primary/70 border border-card-border rounded-xl p-4 sm:p-5 flex items-center gap-5 min-w-[240px]">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" className="text-card-border" fill="transparent" />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-amber-400 transition-all duration-1000 ease-out"
                    fill="transparent"
                    strokeDasharray={175.9}
                    strokeDashoffset={175.9 - (175.9 * unlockPercentage) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-sm font-bold text-white">{unlockPercentage}%</span>
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-text-muted">Trophies Unlocked</div>
                <div className="text-2xl font-extrabold text-white">
                  <span className="text-amber-400">{unlockedCount}</span>
                  <span className="text-text-muted text-lg font-medium"> / {totalCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Game Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Game selector tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            data-focusable="achieve-game-all"
            onClick={() => setSelectedGameId('all')}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all whitespace-nowrap console-focusable ${
              selectedGameId === 'all'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-500/10'
                : 'bg-bg-secondary text-text-muted hover:text-white border border-card-border'
            }`}
          >
            🌟 All Games
          </button>
          {games.map(game => (
            <button
              key={game.id}
              type="button"
              data-focusable={`achieve-game-${game.id}`}
              onClick={() => setSelectedGameId(game.id)}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 console-focusable ${
                selectedGameId === game.id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                  : 'bg-bg-secondary text-text-muted hover:text-white border border-card-border'
              }`}
            >
              <span>{game.metadata?.icon || '🎮'}</span>
              <span>{game.name || game.id}</span>
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 bg-bg-secondary p-1 rounded-xl border border-card-border shrink-0 self-start sm:self-auto">
          {(['all', 'unlocked', 'locked'] as const).map(f => (
            <button
              key={f}
              type="button"
              data-focusable={`achieve-filter-${f}`}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition-all console-focusable-subtle ${
                filter === f
                  ? 'bg-bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Achievements List / Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-bg-secondary/40 border border-card-border animate-pulse p-4" />
          ))}
        </div>
      ) : displayedAchievements.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-card-border bg-bg-secondary/20">
          <span className="text-4xl mb-3">🔒</span>
          <h3 className="text-lg font-bold text-white mb-1">No Achievements Found</h3>
          <p className="text-text-muted text-sm">
            {filter === 'unlocked' ? 'You have not unlocked any achievements in this category yet.' : 'No achievements match the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedAchievements.map(item => {
            const game = getGame(item.gameId);
            return (
              <div
                key={`${item.gameId}-${item.id}`}
                tabIndex={0}
                data-focusable={`achieve-card-${item.gameId}-${item.id}`}
                className={`relative group rounded-2xl border p-5 transition-all flex items-start gap-4 console-focusable ${
                  item.unlocked
                    ? 'bg-gradient-to-br from-amber-500/10 via-bg-secondary to-bg-primary border-amber-500/30 hover:border-amber-400'
                    : 'bg-bg-secondary/40 border-card-border opacity-70 hover:opacity-90'
                }`}
              >
                {/* Icon Badge */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 border transition-all ${
                    item.unlocked
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/20'
                      : 'bg-bg-primary border-card-border text-text-muted grayscale'
                  }`}
                >
                  {item.unlocked ? (item.icon || '🏆') : '🔒'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-base font-bold truncate ${item.unlocked ? 'text-white' : 'text-text-muted'}`}>
                      {item.title}
                    </h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-card-border text-text-muted bg-bg-primary shrink-0">
                      {game?.metadata?.icon} {game?.name || item.gameId}
                    </span>
                  </div>

                  <p className="text-text-muted text-xs sm:text-sm line-clamp-2">
                    {item.description}
                  </p>

                  {/* Progress or Unlocked Timestamp */}
                  <div className="pt-1">
                    {item.unlocked ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                        <span>✓ Unlocked</span>
                        {item.updatedAt && (
                          <span className="text-text-muted font-mono">
                            • {new Date(item.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ) : item.percentComplete > 0 ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-text-muted">
                          <span>Progress</span>
                          <span>{item.percentComplete}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-bg-primary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${item.percentComplete}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted font-mono">Locked</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default AchievementsView;
