import { useState, useEffect, useRef } from 'react';
import { Game } from '../types';
import { SystemMenuOverlay } from '../components/SystemMenuOverlay';
import { LaunchSequence } from '../components/LaunchSequence';
import { verifyPostMessageOrigin, validateRPCMessageEnvelope } from '../utils/security';

interface LauncherViewProps {
  game: Game;
  onExit: () => void;
}

export function LauncherView({ game, onExit }: LauncherViewProps) {
  const [isLaunching, setIsLaunching] = useState(true);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && !!(
      document.fullscreenElement || (document as any).webkitFullscreenElement
    )
  );
  
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
  const handleLaunchComplete = () => {
    setIsLaunching(false);
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
      setIsFullscreen(isFs);
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

  // Listen for postMessages from the game iframe (e.g. for Web API permission requests)
  useEffect(() => {
    if (isLaunching) return;

    let expectedGameOrigin = 'http://localhost';
    try {
      expectedGameOrigin = new URL(resolveGameUrl(game)).origin;
    } catch (e) {
      console.warn('Invalid game URL/origin:', e);
    }

    const handleMessage = async (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;

      // Validate message provenance (both origin and the exact source contentWindow)
      if (!verifyPostMessageOrigin(event, expectedGameOrigin, iframe.contentWindow)) {
        return;
      }

      // Validate envelope structure and type
      if (!validateRPCMessageEnvelope(event.data, 'WGCP_SDK')) {
        return;
      }

      const { id, type, payload } = event.data;

      // Handle permission request
      if (type === 'WGCP_REQUEST_PERMISSION') {
        const { permission } = payload || {};
        let granted = false;
        
        if (permission === 'persistent-storage') {
          try {
            if (navigator.storage && navigator.storage.persist) {
              granted = await navigator.storage.persist();
            }
          } catch (err) {
            console.warn('Error requesting persistent storage permission:', err);
          }
        }

        // Post the ACK back to the game iframe using explicit canonical origin
        iframe.contentWindow.postMessage(
          {
            id,
            type: 'WGCP_REQUEST_PERMISSION_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: {
              permission,
              granted,
            },
          },
          expectedGameOrigin
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isLaunching, game]);

  const resumeGame = () => {
    setIsOverlayOpen(false);
    scheduleAsyncFocus();
  };

  const toggleFullscreen = async () => {
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
    } else {
      const el = document.documentElement;
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } catch (err) {
        console.warn('Fullscreen request failed', err);
      }
    }
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

  const requestedCapabilities = game.hosting?.capabilities;
  const iframeAllow = requestedCapabilities && requestedCapabilities.length > 0
    ? requestedCapabilities.join('; ')
    : 'autoplay; fullscreen; gamepad; focus-without-user-activation; accelerometer; gyroscope; clipboard-read; clipboard-write';

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen bg-black overflow-hidden select-none">
      <div className="w-full h-full relative flex items-center justify-center bg-black">
        <iframe
          ref={iframeRef}
          src={resolveGameUrl(game)}
          className="w-full h-full border-none bg-black block animate-fade-in"
          allow={iframeAllow}
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
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      )}
    </div>
  );
}
export default LauncherView;
