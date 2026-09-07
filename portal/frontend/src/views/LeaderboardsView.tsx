import { useState, useEffect } from 'react';
import { Game, LeaderboardScore } from '../types';
import { getLeaderboardsForGame, GameLeaderboardCatalogItem } from '../utils/gameServicesData';

interface LeaderboardsViewProps {
  games: Game[];
  onLaunchGame: (game: Game) => void;
}

export function LeaderboardsView({ games, onLaunchGame }: LeaderboardsViewProps) {
  const [selectedGameId, setSelectedGameId] = useState<string>(games[0]?.id || '2048');
  const [leaderboardsList, setLeaderboardsList] = useState<GameLeaderboardCatalogItem[]>([]);
  const [selectedLeaderboardId, setSelectedLeaderboardId] = useState<string>('highScore');
  const [scores, setScores] = useState<LeaderboardScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageOffset, setPageOffset] = useState(0);
  const pageSize = 10;

  // Update selected game and its leaderboards
  useEffect(() => {
    if (games.length > 0 && !games.some(g => g.id === selectedGameId)) {
      setSelectedGameId(games[0].id);
    }
  }, [games, selectedGameId]);

  useEffect(() => {
    const list = getLeaderboardsForGame(selectedGameId);
    setLeaderboardsList(list);
    if (!list.some(l => l.id === selectedLeaderboardId)) {
      setSelectedLeaderboardId(list[0]?.id || 'highScore');
    }
    setPageOffset(0);
  }, [selectedGameId]);

  // Fetch leaderboard scores from backend
  useEffect(() => {
    let isMounted = true;
    async function fetchScores() {
      if (!selectedGameId || !selectedLeaderboardId) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/games/${selectedGameId}/leaderboards/${selectedLeaderboardId}?limit=${pageSize}&offset=${pageOffset}`
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setScores(data);
        } else {
          if (isMounted) setScores([]);
        }
      } catch (err) {
        console.error('Failed to load leaderboard scores:', err);
        if (isMounted) setScores([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchScores();
    return () => { isMounted = false; };
  }, [selectedGameId, selectedLeaderboardId, pageOffset]);

  const activeGame = games.find(g => g.id === selectedGameId);
  const activeLeaderboard = leaderboardsList.find(l => l.id === selectedLeaderboardId) || {
    id: selectedLeaderboardId,
    title: 'High Score',
    description: 'Leaderboard standings',
    unit: 'pts',
  };

  const myScore = scores.find(s => s.isMe);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-card-border bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-pink-500/10 p-6 sm:p-8 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl">👑</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Global Leaderboards</h2>
            </div>
            <p className="text-text-muted text-sm sm:text-base max-w-xl">
              Compete for the top rank, compare personal bests, and climb the platform rankings.
            </p>
          </div>

          {/* Personal Best Callout */}
          {myScore ? (
            <div className="bg-bg-primary/80 border border-amber-500/40 rounded-xl p-4 sm:p-5 flex items-center gap-4 min-w-[220px]">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xl border border-amber-500/40">
                #{myScore.rank}
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">Your Best Score</div>
                <div className="text-2xl font-black text-white">
                  {myScore.score.toLocaleString()} <span className="text-text-muted text-xs font-normal">{activeLeaderboard.unit}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-bg-primary/60 border border-card-border rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div className="text-xs text-text-muted">
                Play {activeGame?.name || 'this game'} to claim your leaderboard ranking!
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Game Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {games.map(game => (
          <button
            key={game.id}
            type="button"
            data-focusable={`leaderboard-game-${game.id}`}
            onClick={() => setSelectedGameId(game.id)}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 console-focusable ${
              selectedGameId === game.id
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-lg shadow-purple-500/10'
                : 'bg-bg-secondary text-text-muted hover:text-white border border-card-border'
            }`}
          >
            <span>{game.metadata?.icon || '🎮'}</span>
            <span>{game.name || game.id}</span>
          </button>
        ))}
      </div>

      {/* Leaderboard Category Selector (if multiple exist) */}
      {leaderboardsList.length > 1 && (
        <div className="flex items-center gap-2">
          {leaderboardsList.map(board => (
            <button
              key={board.id}
              type="button"
              data-focusable={`leaderboard-tab-${board.id}`}
              onClick={() => setSelectedLeaderboardId(board.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all console-focusable-subtle ${
                selectedLeaderboardId === board.id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-bg-secondary/60 text-text-muted hover:text-white border border-transparent'
              }`}
            >
              {board.title}
            </button>
          ))}
        </div>
      )}

      {/* Leaderboard Table / Rankings */}
      <div className="rounded-2xl border border-card-border bg-bg-secondary/40 backdrop-blur-md overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-bg-primary/40 border border-card-border animate-pulse" />
            ))}
          </div>
        ) : scores.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <span className="text-4xl">🏆</span>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">No Scores Logged Yet</h3>
              <p className="text-text-muted text-sm max-w-md">
                Be the first player to record a high score on the {activeGame?.name || selectedGameId} leaderboard!
              </p>
            </div>
            {activeGame && (
              <button
                type="button"
                data-focusable="leaderboard-launch-btn"
                onClick={() => onLaunchGame(activeGame)}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all console-focusable"
              >
                ▶ Play {activeGame.name} Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-card-border bg-bg-primary/50 text-xs font-mono uppercase tracking-wider text-text-muted">
                  <th className="py-4 px-6 w-20">Rank</th>
                  <th className="py-4 px-6">Player</th>
                  <th className="py-4 px-6 text-right">Score ({activeLeaderboard.unit})</th>
                  <th className="py-4 px-6 text-right hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border/50 text-sm">
                {scores.map(entry => {
                  const isGold = entry.rank === 1;
                  const isSilver = entry.rank === 2;
                  const isBronze = entry.rank === 3;

                  return (
                    <tr
                      key={`${entry.rank}-${entry.displayName}`}
                      tabIndex={0}
                      data-focusable={`leaderboard-row-${entry.rank}`}
                      className={`group transition-all console-focusable ${
                        entry.isMe
                          ? 'bg-indigo-500/10 font-bold'
                          : 'hover:bg-bg-primary/40'
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-4 px-6 font-mono font-bold">
                        <div className="flex items-center gap-2">
                          {isGold && <span className="text-lg">🥇</span>}
                          {isSilver && <span className="text-lg">🥈</span>}
                          {isBronze && <span className="text-lg">🥉</span>}
                          <span
                            className={`${
                              isGold
                                ? 'text-amber-400'
                                : isSilver
                                ? 'text-gray-300'
                                : isBronze
                                ? 'text-amber-600'
                                : 'text-text-muted'
                            }`}
                          >
                            #{entry.rank}
                          </span>
                        </div>
                      </td>

                      {/* Player */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {entry.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className={`font-bold ${entry.isMe ? 'text-indigo-300' : 'text-white'}`}>
                            @{entry.displayName}
                          </span>
                          {entry.isMe && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Score */}
                      <td className="py-4 px-6 text-right font-mono font-black text-base text-white">
                        <span className={isGold ? 'text-amber-400' : ''}>
                          {entry.score.toLocaleString()}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-6 text-right font-mono text-xs text-text-muted hidden sm:table-cell">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {scores.length > 0 && (
          <div className="p-4 border-t border-card-border flex items-center justify-between bg-bg-primary/30">
            <button
              type="button"
              data-focusable="leaderboard-prev"
              disabled={pageOffset === 0}
              onClick={() => setPageOffset(Math.max(0, pageOffset - pageSize))}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-card-border text-text-muted hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all console-focusable-subtle"
            >
              ← Previous
            </button>
            <span className="text-xs font-mono text-text-muted">
              Page {Math.floor(pageOffset / pageSize) + 1}
            </span>
            <button
              type="button"
              data-focusable="leaderboard-next"
              disabled={scores.length < pageSize}
              onClick={() => setPageOffset(pageOffset + pageSize)}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-card-border text-text-muted hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all console-focusable-subtle"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default LeaderboardsView;
