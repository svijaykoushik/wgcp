import { useEffect } from 'react';
import { Game } from '../types';
import { GameCard } from '../components/GameCard';
import { useSpatialNav } from '../hooks/useSpatialNav';

interface CatalogueViewProps {
  games: Game[];
  libraryIds: string[];
  onAdd: (gameId: string) => void;
  onRemove: (gameId: string) => void;
  onBackToLibrary: () => void;
  focusedElementId?: string | null;
  setFocusedElementId: (id: string | null) => void;
  isActive: boolean;
}

export function CatalogueView({
  games,
  libraryIds,
  onAdd,
  onRemove,
  onBackToLibrary,
  focusedElementId,
  setFocusedElementId,
  isActive,
}: CatalogueViewProps) {
  const containerId = games.length === 0 ? 'catalogue-empty-container' : 'catalogue-grid-container';

  const { focusedId, setFocusedId } = useSpatialNav({
    containerId,
    enabled: isActive,
    initialFocusId: games.length > 0 ? games[0].id : 'back-library-cta',
    onSelect: (id) => {
      if (id === 'back-library-cta') {
        onBackToLibrary();
      } else {
        const inLibrary = libraryIds.includes(id);
        if (inLibrary) {
          onRemove(id);
        } else {
          onAdd(id);
        }
      }
    },
  });

  // Sync spatial focused element ID to parent shell
  useEffect(() => {
    if (isActive) {
      setFocusedElementId(focusedId);
    }
  }, [focusedId, isActive, setFocusedElementId]);

  // Handle PageUp/PageDown bumper events directly in the view
  useEffect(() => {
    if (!isActive) return;
    const handleBumpers = (e: KeyboardEvent) => {
      if (e.key === 'PageUp') {
        e.preventDefault();
        onBackToLibrary();
      }
    };
    window.addEventListener('keydown', handleBumpers);
    return () => window.removeEventListener('keydown', handleBumpers);
  }, [isActive, onBackToLibrary]);

  if (games.length === 0) {
    return (
      <div 
        id="catalogue-empty-container"
        className="text-center p-12 bg-bg-secondary/40 border border-card-border rounded-3xl text-text-muted select-none flex flex-col items-center justify-center gap-4"
      >
        <span>No games currently registered in the platform registry.</span>
        <button
          type="button"
          data-focusable="back-library-cta"
          data-focused={focusedElementId === 'back-library-cta'}
          onFocus={() => setFocusedId('back-library-cta')}
          onClick={onBackToLibrary}
          className={`px-4 py-2 border border-card-border hover:border-indigo-500/40 text-text-main text-sm font-semibold rounded-xl transition-all console-focusable cursor-pointer ${
            focusedElementId === 'back-library-cta' ? 'ring-2 ring-focus-ring' : ''
          }`}
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="select-none">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Game Catalogue</h2>
          <p className="text-sm text-text-muted">Browse all games hosted securely on the platform registry.</p>
        </div>
        <button
          type="button"
          data-focusable="back-library-cta"
          data-focused={focusedElementId === 'back-library-cta'}
          onFocus={() => setFocusedId('back-library-cta')}
          onClick={onBackToLibrary}
          className={`px-4 py-2 border border-card-border hover:border-indigo-500/40 text-text-main text-sm font-semibold rounded-xl transition-all active:scale-95 console-focusable cursor-pointer ${
            focusedElementId === 'back-library-cta' ? 'ring-2 ring-focus-ring' : ''
          }`}
        >
          Back to Library
        </button>
      </div>

      <div
        id="catalogue-grid-container"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {games.map((game, idx) => {
          const inLibrary = libraryIds.includes(game.id);
          return (
            <GameCard
              key={game.id}
              game={game}
              isFocused={focusedElementId === game.id}
              index={idx}
              variant="catalogue"
              inLibrary={inLibrary}
              onAdd={() => onAdd(game.id)}
              onRemove={() => onRemove(game.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
export default CatalogueView;
