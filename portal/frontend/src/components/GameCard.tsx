import React from 'react';
import { Game } from '../types';
import { usePressAnimation } from '../hooks/usePressAnimation';

interface GameCardProps {
  game: Game;
  isFocused: boolean;
  variant: 'library' | 'catalogue';
  inLibrary?: boolean;
  index: number;
  onPlay?: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
}

export function GameCard({
  game,
  isFocused,
  variant,
  inLibrary,
  index,
  onPlay,
  onAdd,
  onRemove,
}: GameCardProps) {
  const isMulti = game.metadata?.multiplayer;
  const { triggerPress, dataPressing } = usePressAnimation();

  const handlePrimaryAction = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Avoid double trigger from bubbling
    e.stopPropagation();
    if (variant === 'library') {
      if (onPlay) triggerPress(onPlay);
    } else {
      if (inLibrary) {
        if (onRemove) triggerPress(onRemove);
      } else {
        if (onAdd) triggerPress(onAdd);
      }
    }
  };

  return (
    <div
      data-focusable={game.id}
      data-focused={isFocused}
      data-pressing={dataPressing}
      tabIndex={0}
      onClick={handlePrimaryAction}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handlePrimaryAction(e);
        }
      }}
      className={`console-focusable console-pressable group flex flex-col justify-between p-6 bg-bg-secondary/70 border rounded-2xl cursor-pointer relative overflow-hidden card-stagger-enter select-none ${
        isFocused
          ? 'border-focus-ring shadow-2xl scale-[1.03]'
          : 'border-card-border hover:border-card-hover-border hover:shadow-2xl'
      }`}
      style={{
        '--stagger-index': index,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
      } as React.CSSProperties}
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

      <div className="space-y-3 mt-auto w-full">
        {variant === 'library' ? (
          <>
            <button
              type="button"
              tabIndex={-1}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              ▶ Play Game
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                if (onRemove) onRemove();
              }}
              className="w-full py-1.5 text-xs text-text-muted hover:text-red-400 font-semibold transition-colors cursor-pointer"
            >
              Remove from Library
            </button>
          </>
        ) : (
          <div>
            {inLibrary ? (
              <div className="flex flex-col gap-2">
                <div className="w-full text-center py-2 bg-indigo-500/10 text-accent-purple text-sm font-semibold rounded-xl border border-indigo-500/30">
                  ✓ In Library
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRemove) onRemove();
                  }}
                  className="w-full py-1 text-xs text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                tabIndex={-1}
                className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Add to Library
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
