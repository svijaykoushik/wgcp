import { useState, useEffect } from 'react';
import { Game } from '../types';

interface LaunchSequenceProps {
  game: Game;
  onComplete: () => void;
}

type LaunchPhase = 'expanding' | 'backdrop' | 'revealing' | 'complete';

export function LaunchSequence({ game, onComplete }: LaunchSequenceProps) {
  const [phase, setPhase] = useState<LaunchPhase>('expanding');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('backdrop'), 400),
      setTimeout(() => setPhase('revealing'), 800),
      setTimeout(() => {
        setPhase('complete');
        onComplete();
      }, 1200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black select-none">
      {/* Phase 1: Expanding card ghost */}
      {phase === 'expanding' && (
        <div className="launch-expand flex flex-col items-center animate-fade-in-up">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl bg-gradient-to-tr from-indigo-500 to-blue-500 shadow-2xl shadow-indigo-500/40">
            {game.metadata?.icon || '🎮'}
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white tracking-tight">
            {game.name || game.id}
          </h2>
          <span className="mt-2 text-xs font-mono font-bold tracking-wider text-accent-purple uppercase">
            Launching Workload Container
          </span>
        </div>
      )}

      {/* Phase 2: Backdrop blur & loading */}
      {(phase === 'backdrop' || phase === 'revealing') && (
        <div className="absolute inset-0 launch-backdrop bg-black/90 flex flex-col items-center justify-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-focus-ring border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-muted font-mono tracking-wider uppercase animate-pulse">
            Loading {game.name || game.id}…
          </span>
        </div>
      )}

      {/* Phase 3: Reveal (handled by parent rendering the iframe) */}
      {phase === 'revealing' && (
        <div className="absolute inset-0 z-20 launch-iframe-reveal bg-black" />
      )}
    </div>
  );
}
export default LaunchSequence;
