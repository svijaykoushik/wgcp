import { Game } from '../types';
import { GameCard } from '../components/GameCard';

interface LibraryViewProps {
  games: Game[];
  onLaunch: (game: Game) => void;
  onRemove: (gameId: string) => void;
  onNavigateToCatalogue: () => void;
}

export function LibraryView({
  games,
  onLaunch,
  onRemove,
  onNavigateToCatalogue,
}: LibraryViewProps) {
  if (games.length === 0) {
    return (
      <div
        id="library-empty-container"
        className="flex flex-col items-center justify-center text-center p-16 border-2 border-dashed border-card-border bg-bg-secondary/20 rounded-3xl backdrop-blur-sm select-none"
      >
        <span className="text-5xl mb-4 animate-bounce">👾</span>
        <h3 className="text-xl font-bold text-white mb-2">Your library is currently empty</h3>
        <p className="text-sm text-text-muted max-w-md mb-6">
          Before you can play, browse the platform catalogue and add games to your personal library.
        </p>
        <button
          type="button"
          data-focusable="browse-cta"
          onClick={onNavigateToCatalogue}
          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95 console-focusable cursor-pointer"
        >
          Browse Catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="select-none">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">My Game Library</h2>
          <p className="text-sm text-text-muted">Launch your added games directly from containerized workloads.</p>
        </div>
        <button
          type="button"
          id="add-more-cta"
          data-focusable="add-more-cta"
          onClick={onNavigateToCatalogue}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl transition-all shadow-md active:scale-95 console-focusable cursor-pointer"
        >
          + Add More Games
        </button>
      </div>

      <div
        id="library-grid-container"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {games.map((game, idx) => (
          <GameCard
            key={game.id}
            game={game}
            index={idx}
            variant="library"
            onPlay={() => onLaunch(game)}
            onRemove={() => onRemove(game.id)}
          />
        ))}
      </div>
    </div>
  );
}
export default LibraryView;
