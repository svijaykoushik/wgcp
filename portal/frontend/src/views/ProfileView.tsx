import { useState, useEffect } from 'react';
import { User, Game, UserProfileResponse } from '../types';

interface ProfileViewProps {
  user: User;
  games: Game[];
  onLaunchGame: (game: Game) => void;
  onNavigateToCatalogue: () => void;
}

export function ProfileView({ user, games, onLaunchGame, onNavigateToCatalogue }: ProfileViewProps) {
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchProfile() {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/profile');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setProfileData(data);
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProfile();
    return () => { isMounted = false; };
  }, []);

  const overall = profileData?.overall || {
    level: 1,
    currentXp: 0,
    nextLevelXp: 100,
    totalXp: 0,
    unlockedAchievementsCount: 0,
  };

  const xpPercent = overall.nextLevelXp > 0
    ? Math.min(100, Math.round((overall.currentXp / overall.nextLevelXp) * 100))
    : 0;

  const getGameProgression = (gameId: string) => {
    return profileData?.progression.find(p => p.gameId === gameId) || {
      level: 1,
      currentXp: 0,
      totalXp: 0,
    };
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Player Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-card-border bg-gradient-to-br from-indigo-900/40 via-bg-secondary to-bg-primary p-6 sm:p-10 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          {/* Avatar with Crest */}
          <div className="relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-amber-500 via-purple-600 to-indigo-500 p-1 shadow-xl shadow-indigo-500/20">
              <div className="w-full h-full rounded-full bg-bg-primary flex items-center justify-center text-3xl sm:text-4xl font-black text-white">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 px-3 py-1 bg-amber-500 text-bg-primary text-xs font-black rounded-full shadow-lg border-2 border-bg-primary">
              LVL {overall.level}
            </div>
          </div>

          {/* User Details & XP Bar */}
          <div className="flex-1 text-center md:text-left space-y-4 w-full">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-center md:justify-start gap-2 sm:gap-4">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  @{user.username}
                </h2>
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 self-center">
                  Console Champion
                </span>
              </div>
              <p className="text-text-muted text-xs sm:text-sm font-mono mt-1">
                Player ID: #{user.id.toString().padStart(6, '0')} • WGCP Verified
              </p>
            </div>

            {/* Leveling Curve Progress Bar */}
            <div className="space-y-2 max-w-xl">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-amber-400 font-bold">Level {overall.level}</span>
                <span className="text-text-muted">
                  {overall.currentXp} / {overall.nextLevelXp} XP ({overall.nextLevelXp - overall.currentXp} XP to Level {overall.level + 1})
                </span>
              </div>
              <div className="h-3 w-full bg-bg-primary rounded-full overflow-hidden border border-card-border p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          tabIndex={0}
          data-focusable="profile-metric-xp"
          className="rounded-2xl border border-card-border bg-bg-secondary/40 p-5 backdrop-blur-md console-focusable"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⚡</span>
            <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Total XP</span>
          </div>
          <div className="text-2xl font-black text-white">{overall.totalXp.toLocaleString()}</div>
        </div>

        <div
          tabIndex={0}
          data-focusable="profile-metric-trophies"
          className="rounded-2xl border border-card-border bg-bg-secondary/40 p-5 backdrop-blur-md console-focusable"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🏆</span>
            <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Trophies</span>
          </div>
          <div className="text-2xl font-black text-amber-400">{overall.unlockedAchievementsCount}</div>
        </div>

        <div
          tabIndex={0}
          data-focusable="profile-metric-library"
          className="rounded-2xl border border-card-border bg-bg-secondary/40 p-5 backdrop-blur-md console-focusable"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🎮</span>
            <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Library Games</span>
          </div>
          <div className="text-2xl font-black text-indigo-300">{profileData?.library.length || 0}</div>
        </div>

        <div
          tabIndex={0}
          data-focusable="profile-metric-scores"
          className="rounded-2xl border border-card-border bg-bg-secondary/40 p-5 backdrop-blur-md console-focusable"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">👑</span>
            <span className="text-xs font-mono uppercase tracking-wider text-text-muted">High Scores</span>
          </div>
          <div className="text-2xl font-black text-purple-300">{profileData?.leaderboards.length || 0}</div>
        </div>
      </div>

      {/* Per-Game Progression & Activity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>🎮</span> Game Progression & Cloud Saves
          </h3>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-bg-secondary/40 border border-card-border animate-pulse" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-card-border bg-bg-secondary/20">
            <p className="text-text-muted text-sm">No games installed in your library yet.</p>
            <button
              type="button"
              data-focusable="profile-browse-btn"
              onClick={onNavigateToCatalogue}
              className="mt-4 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl console-focusable"
            >
              Browse Catalogue
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map(game => {
              const prog = getGameProgression(game.id);
              const gameAchievements = profileData?.achievements.filter(a => a.gameId === game.id) || [];
              const unlockedTrophies = gameAchievements.filter(a => a.unlocked).length;
              const nextXp = prog.level * 100;
              const progPercent = nextXp > 0 ? Math.min(100, Math.round((prog.currentXp / nextXp) * 100)) : 0;

              return (
                <div
                  key={game.id}
                  tabIndex={0}
                  data-focusable={`profile-game-${game.id}`}
                  className="rounded-2xl border border-card-border bg-bg-secondary/40 p-5 flex flex-col justify-between gap-4 backdrop-blur-md transition-all hover:border-indigo-500/40 console-focusable"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-bg-primary border border-card-border flex items-center justify-center text-2xl shrink-0">
                        {game.metadata?.icon || '🎮'}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">{game.name || game.id}</h4>
                        <span className="text-xs font-mono text-text-muted">{game.metadata?.genre || 'Arcade'}</span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      LVL {prog.level}
                    </span>
                  </div>

                  {/* Level XP Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono text-text-muted">
                      <span>XP Progress</span>
                      <span>{prog.currentXp} / {nextXp} XP</span>
                    </div>
                    <div className="h-2 w-full bg-bg-primary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${progPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Card Footer: Trophies & Play CTA */}
                  <div className="flex items-center justify-between pt-2 border-t border-card-border/50 text-xs">
                    <div className="flex items-center gap-3 text-text-muted">
                      <span>🏆 {unlockedTrophies} trophies</span>
                      <span className="text-emerald-400">☁️ Synced</span>
                    </div>

                    <button
                      type="button"
                      data-focusable={`profile-play-${game.id}`}
                      onClick={() => onLaunchGame(game)}
                      className="px-3.5 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold rounded-lg transition-all console-focusable-subtle"
                    >
                      Play →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
export default ProfileView;
