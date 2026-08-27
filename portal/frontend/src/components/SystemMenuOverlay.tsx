import { Game } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SystemMenuOverlayProps {
  game: Game;
  onResume: () => void;
  onExit: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function SystemMenuOverlay({ 
  game, 
  onResume, 
  onExit,
  isFullscreen,
  onToggleFullscreen
}: SystemMenuOverlayProps) {
  const trapRef = useFocusTrap(true);

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-6 select-none">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-xl overlay-backdrop-enter" 
        onClick={onResume} 
      />
      <div
        ref={trapRef}
        className="relative bg-bg-secondary/90 border border-white/12 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl backdrop-blur-2xl overlay-panel-enter"
        role="dialog"
        aria-modal="true"
        aria-label="System Menu"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-gradient-to-tr from-indigo-500 to-blue-500 shadow-xl shadow-indigo-500/25">
            {game.metadata?.icon || '🎮'}
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">{game.name || game.id}</h2>
          <span className="text-xs font-mono font-semibold uppercase px-2.5 py-1 rounded-full bg-indigo-500/15 text-accent-purple border border-indigo-500/30">
            {game.metadata?.genre || 'HTML5 Game'}
          </span>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95 console-focusable cursor-pointer"
          >
            ▶ Resume Game
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="w-full py-3 px-4 bg-bg-primary hover:bg-bg-primary/80 border border-white/12 text-text-muted hover:text-white font-semibold rounded-xl transition-all active:scale-95 console-focusable cursor-pointer"
          >
            {isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Enter Fullscreen'}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="w-full py-3 px-4 bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 hover:border-red-500/50 hover:text-white font-semibold rounded-xl transition-all active:scale-95 console-focusable cursor-pointer"
          >
            ⏻ Exit to Library
          </button>
        </div>

        <div className="mt-6 text-xs text-text-muted font-mono">
          Press <kbd className="bg-bg-primary px-1.5 py-0.5 rounded border border-card-border text-white text-[10px]">ESC</kbd> or <kbd className="bg-bg-primary px-1.5 py-0.5 rounded border border-card-border text-white text-[10px]">Ⓑ</kbd> to toggle menu
        </div>
      </div>
    </div>
  );
}
export default SystemMenuOverlay;
