import { Game } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ConflictResolutionOverlayProps {
  game: Game;
  localState: { revision: number; updatedAt: number };
  cloudState: { revision: number; updatedAt: number };
  onSelect: (choice: 'CLOUD' | 'LOCAL') => void;
}

export function ConflictResolutionOverlay({
  game,
  localState,
  cloudState,
  onSelect
}: ConflictResolutionOverlayProps) {
  const trapRef = useFocusTrap(true);

  const formatDate = (epochMs: number) => {
    return new Date(epochMs).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  return (
    <div className="fixed inset-0 z-[10004] flex items-center justify-center p-6 select-none">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />
      <div
        ref={trapRef}
        className="relative bg-bg-secondary/90 border border-white/12 rounded-3xl p-8 max-w-lg w-full shadow-2xl backdrop-blur-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Cloud Save Sync Conflict"
      >
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-gradient-to-tr from-yellow-500 to-amber-500 shadow-xl shadow-yellow-500/25 animate-pulse">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Sync Conflict Detected</h2>
          <p className="text-sm text-text-muted">
            Choose which save track you want to use for <strong className="text-white">{game.name || game.id}</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Local Save Track Card */}
          <div className="flex flex-col justify-between border border-white/10 rounded-2xl p-5 bg-white/5 hover:border-yellow-500/30 transition-all">
            <div>
              <h3 className="text-base font-bold text-yellow-500 mb-1">💻 Local Progress</h3>
              <p className="text-xs text-text-muted mb-4 font-mono">Contains offline saves not synced to cloud.</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted text-xs">Revision:</span>
                <span className="text-white font-mono font-bold">{localState.revision}</span>
              </div>
              <div className="flex flex-col mt-1">
                <span className="text-text-muted text-2xs">Last Saved:</span>
                <span className="text-white font-mono text-2xs truncate">{formatDate(localState.updatedAt)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelect('LOCAL')}
              className="mt-6 w-full py-2.5 px-4 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-xl transition-all active:scale-95 console-focusable cursor-pointer text-xs"
            >
              ✓ Keep Local Save
            </button>
          </div>

          {/* Cloud Save Track Card */}
          <div className="flex flex-col justify-between border border-white/10 rounded-2xl p-5 bg-white/5 hover:border-indigo-500/30 transition-all">
            <div>
              <h3 className="text-base font-bold text-indigo-400 mb-1">☁️ Cloud Progress</h3>
              <p className="text-xs text-text-muted mb-4 font-mono">Latest progress stored on portal servers.</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted text-xs">Revision:</span>
                <span className="text-white font-mono font-bold">{cloudState.revision}</span>
              </div>
              <div className="flex flex-col mt-1">
                <span className="text-text-muted text-2xs">Last Saved:</span>
                <span className="text-white font-mono text-2xs truncate">{formatDate(cloudState.updatedAt)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelect('CLOUD')}
              className="mt-6 w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-all active:scale-95 console-focusable cursor-pointer text-xs"
            >
              ✓ Load Cloud Save
            </button>
          </div>
        </div>

        <p className="text-3xs text-center text-text-muted/65 leading-normal">
          WARNING: Selecting "Load Cloud Save" will permanently discard the unsynced local progress on this device.
        </p>
      </div>
    </div>
  );
}
export default ConflictResolutionOverlay;
