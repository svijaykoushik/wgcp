import { useState, useEffect, useRef } from 'react';
import { Game } from '../types';
import { SystemMenuOverlay } from '../components/SystemMenuOverlay';
import { LaunchSequence } from '../components/LaunchSequence';
import { PermissionRequestOverlay } from '../components/PermissionRequestOverlay';
import { ConflictResolutionOverlay } from '../components/ConflictResolutionOverlay';
import { verifyPostMessageOrigin, validateRPCMessageEnvelope } from '../utils/security';

interface LauncherViewProps {
  game: Game;
  onExit: () => void;
}

interface PendingPermissionRequest {
  id: string;
  permission: string;
  expectedGameOrigin: string;
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
  const [pendingPermission, setPendingPermission] = useState<PendingPermissionRequest | null>(null);
  const [pendingConflict, setPendingConflict] = useState<{
    localState: any;
    cloudState: any;
    eventSource: Window;
    eventOrigin: string;
  } | null>(null);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const focusTimersRef = useRef<number[]>([]);
  const isOverlayOpenRef = useRef(isOverlayOpen);
  const lastToggleTimeRef = useRef<number>(0);

  useEffect(() => {
    isOverlayOpenRef.current = isOverlayOpen;
  }, [isOverlayOpen]);

  // Resolve game endpoint URL
  const resolveGameUrl = (gameItem: Game) => {
    let baseUrl = '';
    if (gameItem.url) {
      baseUrl = gameItem.url;
    } else if (gameItem.hosting?.hostname) {
      baseUrl = `http://${gameItem.hosting.hostname}`;
    } else {
      baseUrl = `http://${gameItem.id}.localhost`;
    }

    try {
      const urlObj = new URL(baseUrl);
      urlObj.searchParams.set('wgcp_origin', window.location.origin);
      return urlObj.toString();
    } catch {
      return baseUrl;
    }
  };

  const focusIframe = () => {
    const iframe = iframeRef.current;
    if (!iframe || isOverlayOpenRef.current) return;
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

  const resumeGame = () => {
    lastToggleTimeRef.current = Date.now();
    setIsOverlayOpen(false);
    scheduleAsyncFocus();
  };

  const toggleOverlay = () => {
    const now = Date.now();
    if (now - lastToggleTimeRef.current < 350) return;
    lastToggleTimeRef.current = now;

    if (isOverlayOpenRef.current) {
      resumeGame();
    } else {
      setIsOverlayOpen(true);
    }
  };

  // Listen for ESC/Start key triggers inside the portal launcher window
  useEffect(() => {
    if (isLaunching) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        toggleOverlay();
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isLaunching]);

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
      const contentWindow = iframe.contentWindow;

      try {
        if (type === 'WGCP_INIT') {
          let cloudRevision = 0;
          let cloudState = null;
          try {
            const res = await fetch(`/api/v1/games/${game.id}/saves/gameState`);
            if (res.ok) {
              const data = await res.json();
              cloudRevision = data.revision;
              cloudState = data;
            }
          } catch (e) {
            console.warn("Handshake cloud save check failed", e);
          }

          // Get logged in user if possible
          let playerId = 'guest';
          try {
            const res = await fetch('/api/v1/auth/me');
            if (res.ok) {
              const user = await res.json();
              playerId = user.username;
            }
          } catch (e) {}

          contentWindow.postMessage({
            id,
            type: 'WGCP_INIT_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: {
              playerId,
              cloudRevision,
              cloudState,
              settings: { locale: 'en-US', muted: false, volume: 1.0, theme: 'console-dark' }
            }
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_SAVE') {
          const res = await fetch(`/api/v1/games/${game.id}/saves/${payload.slot}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const ack = await res.json();
            contentWindow.postMessage({
              id,
              type: 'WGCP_SAVE_ACK',
              source: 'WGCP_PORTAL',
              version: '2.0.0',
              payload: { revision: ack.revision }
            }, expectedGameOrigin);
          } else {
            const errData = await res.json();
            contentWindow.postMessage({
              id,
              type: 'WGCP_SAVE_NACK',
              source: 'WGCP_PORTAL',
              version: '2.0.0',
              error: errData
            }, expectedGameOrigin);
          }
        }
        else if (type === 'WGCP_LOAD') {
          try {
            const res = await fetch(`/api/v1/games/${game.id}/saves/${payload.slot}`);
            if (res.ok) {
              const data = await res.json();
              contentWindow.postMessage({
                id,
                type: 'WGCP_LOAD_ACK',
                source: 'WGCP_PORTAL',
                version: '2.0.0',
                payload: {
                  slot: payload.slot,
                  payload: data.payload,
                  checksum: data.checksum,
                  revision: data.revision,
                  updatedAt: data.updatedAt
                }
              }, expectedGameOrigin);
            } else {
              contentWindow.postMessage({
                id,
                type: 'WGCP_LOAD_ACK',
                source: 'WGCP_PORTAL',
                version: '2.0.0',
                payload: null
              }, expectedGameOrigin);
            }
          } catch (e) {
            contentWindow.postMessage({
              id,
              type: 'WGCP_LOAD_ACK',
              source: 'WGCP_PORTAL',
              version: '2.0.0',
              payload: null
            }, expectedGameOrigin);
          }
        }
        else if (type === 'WGCP_DELETE') {
          await fetch(`/api/v1/games/${game.id}/saves/${payload.slot}`, { method: 'DELETE' });
          contentWindow.postMessage({
            id,
            type: 'WGCP_DELETE_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: { success: true }
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_ACHIEVEMENT_UNLOCK') {
          const res = await fetch(`/api/v1/games/${game.id}/achievements/${payload.achievementId}/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txId: payload.txId })
          });
          const data = await res.json();
          contentWindow.postMessage({
            id,
            type: 'WGCP_ACHIEVEMENT_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: data
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_ACHIEVEMENT_INCREMENT') {
          const res = await fetch(`/api/v1/games/${game.id}/achievements/${payload.achievementId}/increment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txId: payload.txId, step: payload.step })
          });
          const data = await res.json();
          contentWindow.postMessage({
            id,
            type: 'WGCP_ACHIEVEMENT_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: data
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_ACHIEVEMENT_PROGRESS') {
          const res = await fetch(`/api/v1/games/${game.id}/achievements`);
          const data = await res.json();
          contentWindow.postMessage({
            id,
            type: 'WGCP_ACHIEVEMENT_PROGRESS_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: data
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_LEADERBOARD_TOKEN') {
          const res = await fetch(`/api/v1/games/${game.id}/leaderboards/${payload.leaderboardId}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionLengthMs: payload.sessionLengthMs,
              gameActivityScore: payload.gameActivityScore
            })
          });
          const data = await res.json();
          contentWindow.postMessage({
            id,
            type: 'WGCP_LEADERBOARD_TOKEN_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: data
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_LEADERBOARD_SUBMIT') {
          const res = await fetch(`/api/v1/games/${game.id}/leaderboards/${payload.leaderboardId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: payload.token,
              score: payload.score,
              metadata: payload.metadata
            })
          });
          const data = await res.json();
          contentWindow.postMessage({
            id,
            type: 'WGCP_LEADERBOARD_SUBMIT_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: data
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_LEADERBOARD_GET_SCORES') {
          const res = await fetch(`/api/v1/games/${game.id}/leaderboards/${payload.leaderboardId}?limit=${payload.query?.limit || 10}&offset=${payload.query?.offset || 0}`);
          const data = await res.json();
          contentWindow.postMessage({
            id,
            type: 'WGCP_LEADERBOARD_GET_SCORES_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: data
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_LEADERBOARD_PERSONAL_BEST') {
          const res = await fetch(`/api/v1/games/${game.id}/leaderboards/${payload.leaderboardId}`);
          const data = await res.json();
          const me = data.find((entry: any) => entry.isMe);
          contentWindow.postMessage({
            id,
            type: 'WGCP_LEADERBOARD_PERSONAL_BEST_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: me ? { leaderboardId: payload.leaderboardId, score: me.score, achievedAt: me.timestamp, metadata: me.metadata } : null
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_STATS') {
          const res = await fetch(`/api/v1/games/${game.id}/stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            contentWindow.postMessage({
              id,
              type: 'WGCP_STATS_ACK',
              source: 'WGCP_PORTAL',
              version: '2.0.0',
              payload: { success: true }
            }, expectedGameOrigin);
          }
        }
        else if (type === 'WGCP_STATS_GET') {
          try {
            const res = await fetch(`/api/v1/games/${game.id}/stats`);
            if (res.ok) {
              const data = await res.json();
              contentWindow.postMessage({
                id,
                type: 'WGCP_STATS_GET_ACK',
                source: 'WGCP_PORTAL',
                version: '2.0.0',
                payload: data
              }, expectedGameOrigin);
            } else {
              contentWindow.postMessage({
                id,
                type: 'WGCP_STATS_GET_ACK',
                source: 'WGCP_PORTAL',
                version: '2.0.0',
                payload: []
              }, expectedGameOrigin);
            }
          } catch (e) {
            contentWindow.postMessage({
              id,
              type: 'WGCP_STATS_GET_ACK',
              source: 'WGCP_PORTAL',
              version: '2.0.0',
              payload: []
            }, expectedGameOrigin);
          }
        }
        else if (type === 'WGCP_PROGRESSION_ADD_XP') {
          const res = await fetch(`/api/v1/games/${game.id}/progression/addXP`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: payload.amount })
          });
          const data = await res.json();
          contentWindow.postMessage({
            id,
            type: 'WGCP_PROGRESSION_ADD_XP_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: data
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_PROGRESSION_GET') {
          const res = await fetch(`/api/v1/games/${game.id}/progression`);
          const data = await res.json();
          contentWindow.postMessage({
            id,
            type: 'WGCP_PROGRESSION_GET_ACK',
            source: 'WGCP_PORTAL',
            version: '2.0.0',
            payload: data
          }, expectedGameOrigin);
        }
        else if (type === 'WGCP_CONFLICT_TRIGGER') {
          setPendingConflict({
            localState: payload.localState,
            cloudState: payload.cloudState,
            eventSource: event.source as Window,
            eventOrigin: event.origin
          });
        }
        else if (type === 'WGCP_REQUEST_PERMISSION') {
          const { permission } = payload || {};
          
          if (permission === 'persistent-storage') {
            if (navigator.storage && navigator.storage.persisted) {
              navigator.storage.persisted().then((isPersisted) => {
                if (isPersisted) {
                  contentWindow.postMessage(
                    {
                      id,
                      type: 'WGCP_REQUEST_PERMISSION_ACK',
                      source: 'WGCP_PORTAL',
                      version: '2.0.0',
                      payload: { permission: 'persistent-storage', granted: true }
                    },
                    expectedGameOrigin
                  );
                } else {
                  setPendingPermission({
                    id,
                    permission,
                    expectedGameOrigin
                  });
                }
              }).catch(() => {
                setPendingPermission({
                  id,
                  permission,
                  expectedGameOrigin
                });
              });
            } else {
              setPendingPermission({
                id,
                permission,
                expectedGameOrigin
              });
            }
          } else {
            // Auto-deny unsupported permissions
            contentWindow.postMessage(
              {
                id,
                type: 'WGCP_REQUEST_PERMISSION_ACK',
                source: 'WGCP_PORTAL',
                version: '2.0.0',
                payload: {
                  permission,
                  granted: false,
                },
              },
              expectedGameOrigin
            );
          }
        } else if (type === 'WGCP_TOGGLE_MENU') {
          toggleOverlay();
        }
      } catch (err) {
        console.error("Error processing SDK message in portal:", err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isLaunching, game]);

  const handlePermissionDecision = async (granted: boolean) => {
    if (!pendingPermission) return;
    const { id, permission, expectedGameOrigin } = pendingPermission;
    setPendingPermission(null);

    let finalGranted = false;
    if (granted && permission === 'persistent-storage') {
      try {
        if (navigator.storage && navigator.storage.persist) {
          finalGranted = await navigator.storage.persist();
        }
      } catch (err) {
        console.warn('Error requesting persistent storage permission:', err);
      }
    }

    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          id,
          type: 'WGCP_REQUEST_PERMISSION_ACK',
          source: 'WGCP_PORTAL',
          version: '2.0.0',
          payload: {
            permission,
            granted: finalGranted,
          },
        },
        expectedGameOrigin
      );
    }
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

      {/* Permission Request Overlay */}
      {pendingPermission && (
        <PermissionRequestOverlay
          game={game}
          permission={pendingPermission.permission}
          onAllow={() => handlePermissionDecision(true)}
          onDeny={() => handlePermissionDecision(false)}
        />
      )}

      {/* Conflict Resolution Overlay */}
      {pendingConflict && (
        <ConflictResolutionOverlay
          game={game}
          localState={pendingConflict.localState}
          cloudState={pendingConflict.cloudState}
          onSelect={async (choice) => {
            let serverState = null;
            if (choice === 'CLOUD') {
              try {
                const res = await fetch(`/api/v1/games/${game.id}/saves/gameState`);
                if (res.ok) {
                  serverState = await res.json();
                }
              } catch (e) {
                console.error("Failed to fetch server state for resolution:", e);
              }
            }

            pendingConflict.eventSource.postMessage({
              type: 'WGCP_CONFLICT_RESOLUTION',
              source: 'WGCP_PORTAL',
              version: '2.0.0',
              payload: {
                choice,
                serverState
              }
            }, pendingConflict.eventOrigin);

            setPendingConflict(null);
            scheduleAsyncFocus();
          }}
        />
      )}
    </div>
  );
}
export default LauncherView;
