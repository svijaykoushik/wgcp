import { Game } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface PermissionRequestOverlayProps {
  game: Game;
  permission: string;
  onAllow: () => void;
  onDeny: () => void;
}

export function PermissionRequestOverlay({
  game,
  permission,
  onAllow,
  onDeny
}: PermissionRequestOverlayProps) {
  const trapRef = useFocusTrap(true);

  const formatPermission = (perm: string) => {
    if (perm === 'persistent-storage') {
      return 'Persistent Storage';
    }
    return perm;
  };

  return (
    <div className="fixed inset-0 z-[10003] flex items-center justify-center p-6 select-none">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-xl" 
        onClick={onDeny} 
      />
      <div
        ref={trapRef}
        className="relative bg-bg-secondary/90 border border-white/12 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl backdrop-blur-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Permission Request"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-gradient-to-tr from-indigo-500 to-blue-500 shadow-xl shadow-indigo-500/25 animate-pulse">
            🔑
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Permission Request</h2>
          <p className="text-sm text-text-muted">
            <strong className="text-white">{game.name || game.id}</strong> is requesting access to:
          </p>
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-accent-purple text-xs font-mono font-semibold">
            {formatPermission(permission)}
          </div>
          <p className="mt-4 text-xs text-text-muted leading-relaxed">
            This permission allows the game to protect your local save progress and configurations from being deleted by the browser.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onAllow}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95 console-focusable cursor-pointer"
          >
            ✓ Allow
          </button>
          <button
            type="button"
            onClick={onDeny}
            className="w-full py-3 px-4 bg-bg-primary hover:bg-bg-primary/80 border border-white/12 text-text-muted hover:text-white font-semibold rounded-xl transition-all active:scale-95 console-focusable cursor-pointer"
          >
            ✗ Deny
          </button>
        </div>
      </div>
    </div>
  );
}
export default PermissionRequestOverlay;
