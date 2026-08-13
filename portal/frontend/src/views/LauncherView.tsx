import { useState, useEffect, useRef } from 'react';
import { Game } from '../types';
import { SystemMenuOverlay } from '../components/SystemMenuOverlay';
import { LaunchSequence } from '../components/LaunchSequence';

interface LauncherViewProps {
  game: Game;
  onExit: () => void;
}

export function LauncherView({ game, onExit }: LauncherViewProps) {
  const [isLaunching, setIsLaunching] = useState(true);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const focusTimersRef = useRef<number[]>([]);

  // Resolve game endpoint URL
  const resolveGameUrl = (gameItem: Game) => {
    if (gameItem.url) return gameItem.url;
    if (gameItem.hosting?.hostname) return `http://${gameItem.hosting.hostname}`;
    return `http://${gameItem.id}.localhost`;
  };

  const focusIframe = () => {
    const iframe = iframeRef.current;
    if (!iframe || isOverlayOpen) return;
    try {
      iframe.focus();
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
      }
    } catch (e) {
      iframe.focus();
    }
  };

  const scheduleAsyncFocus = () => {
    // Clear old focus timers
    focusTimersRef.current.forEach((t) => clearTimeout(t));
    focusTimersRef.current = [];

    requestAnimationFrame(() => focusIframe());
    const delays = [50, 150, 300, 600, 1200];
    delays.forEach((delay) => {
      const timer = window.setTimeout(() => focusIframe(), delay);
      focusTimersRef.current.push(timer);
    });
  };

  // Handle launch ceremony transition completion
  const handleLaunchComplete = async () => {
    setIsLaunching(false);

    // Request browser fullscreen when iframe starts loading
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen declined/unsupported', err);
    }

    scheduleAsyncFocus();
  };

  // Listen for ESC/Start key triggers inside the portal launcher window
  useEffect(() => {
    if (isLaunching) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isOverlayOpen) {
          resumeGame();
        } else {
          setIsOverlayOpen(true);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isLaunching, isOverlayOpen]);

  // Handle exit fullscreen to auto-reveal system menu overlay
  useEffect(() => {
    if (isLaunching) return;

    function handleFullscreenChange() {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );
      if (!isFs && !isClosing && !isOverlayOpen) {
        setIsOverlayOpen(true);
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isLaunching, isClosing, isOverlayOpen]);

  const resumeGame = async () => {
    setIsOverlayOpen(false);
    const isFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement
    );
    if (!isFs) {
      const el = document.documentElement;
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } catch (err) {
        console.warn('Fullscreen request failed on resume', err);
      }
    }
    scheduleAsyncFocus();
  };

  const handleExitToLibrary = async () => {
    setIsClosing(true);
    focusTimersRef.current.forEach((t) => clearTimeout(t));
    focusTimersRef.current = [];
    setIsOverlayOpen(false);

    // Exit browser fullscreen
    const isFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement
    );
    if (isFs) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      } catch (err) {
        console.warn('Error exiting fullscreen', err);
      }
    }
    setIsClosing(false);
    onExit();
  };

  if (isLaunching) {
    return <LaunchSequence game={game} onComplete={handleLaunchComplete} />;
  }

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen bg-black overflow-hidden select-none">
      <div className="w-full h-full relative flex items-center justify-center bg-black">
        <iframe
          ref={iframeRef}
          src={resolveGameUrl(game)}
          className="w-full h-full border-none bg-black block animate-fade-in"
          allow="autoplay; fullscreen; gamepad; focus-without-user-activation; accelerometer; gyroscope; clipboard-read; clipboard-write"
          onLoad={scheduleAsyncFocus}
        />
      </div>

      {/* Floating System Menu Trigger (Keyboard/Touch back-up) */}
      <button
        type="button"
        onClick={() => setIsOverlayOpen(true)}
        className="absolute top-4 right-4 z-[10001] inline-flex items-center gap-2 bg-bg-secondary/75 border border-white/15 text-text-muted hover:text-white rounded-full px-4 py-2 text-xs font-mono transition-all duration-200 hover:bg-bg-secondary hover:border-card-hover-border hover:shadow-lg opacity-40 hover:opacity-100 cursor-pointer"
        title="System Menu (ESC)"
      >
        ⚙ System Menu
      </button>

      {/* Decoupled System Menu Overlay */}
      {isOverlayOpen && (
        <SystemMenuOverlay
          game={game}
          onResume={resumeGame}
          onExit={handleExitToLibrary}
        />
      )}
    </div>
  );
}
export default LauncherView;
