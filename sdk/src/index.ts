import { initStorage, storageAPI, handleSaveACK, handleConflictResolution } from "./storage/index.js";
import { initStats, statsAPI, handleStatsACK } from "./stats/index.js";
import { servicesAPI, handleIdentityMigrationACK } from "./services/index.js";

// SDK State Machine definitions
export type SDKState = 'UNINITIALIZED' | 'HANDSHAKING' | 'READY_IDLE' | 'CONFLICT_RESOLVING' | 'MIGRATING' | 'PAUSED_OVERLAY';

let currentState: SDKState = 'UNINITIALIZED';
let portalOrigin = "http://localhost";
let allowedOrigins: string[] = ["http://localhost"];
let activePlayerId = "";
let gameId = "";

export function getState(): SDKState {
  return currentState;
}

export function setState(state: SDKState) {
  currentState = state;
}

export function getPortalOrigin(): string {
  return portalOrigin;
}

export function getGameId(): string {
  return gameId;
}

// Map to track asynchronous RPC promise matching
export const pendingPromises = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

// Event emitter style callbacks for system overlays
const systemListeners = {
  onPause: [] as (() => void)[],
  onResume: [] as ((ctx: { pausedDurationMs: number; resumeTimestamp: number }) => void)[],
  onSettingsChanged: [] as ((settings: any) => void)[],
  onPlayerChanged: [] as ((player: any) => void)[]
};

// Default system settings
let currentSettings = {
  locale: 'en-US',
  muted: false,
  volume: 1.0,
  theme: 'console-dark'
};

// Backup reference of original getGamepads
let originalGetGamepads: typeof navigator.getGamepads | null = null;

// Proxy Gamepad API to prevent bleed during pause menus (P-003 §3.4)
function setupGamepadProxy() {
  if (originalGetGamepads) return;
  originalGetGamepads = navigator.getGamepads.bind(navigator);
  
  Object.defineProperty(navigator, 'getGamepads', {
    value: function() {
      if (currentState === 'PAUSED_OVERLAY' || currentState === 'CONFLICT_RESOLVING') {
        // Return simulated zeroed neutral gamepads
        return [null, null, null, null];
      }
      return originalGetGamepads ? originalGetGamepads() : [null, null, null, null];
    },
    configurable: true,
    writable: true
  });
}

// Media Audio state controls (P-003 §3.4)
const suspendedAudioContexts: AudioContext[] = [];

function suspendAudioAndMedia() {
  // Capture all active AudioContexts in document if possible
  const contexts = (window as any)._activeAudioContexts || [];
  contexts.forEach((ctx: AudioContext) => {
    if (ctx.state === 'running') {
      ctx.suspend();
      suspendedAudioContexts.push(ctx);
    }
  });

  // Pause HTML5 audio and video elements
  const mediaElements = document.querySelectorAll('audio, video');
  mediaElements.forEach((el) => {
    try {
      (el as HTMLMediaElement).pause();
    } catch (e) {}
  });

  // Release Pointer Lock
  if (document.exitPointerLock) {
    document.exitPointerLock();
  }

  // Trigger synthetic keyup events to prevent sticky/ghost keys upon resumption
  const keyupEvent = new KeyboardEvent('keyup', { bubbles: true, cancelable: true });
  window.dispatchEvent(keyupEvent);
}

function resumeAudioAndMedia() {
  suspendedAudioContexts.forEach((ctx) => {
    try {
      ctx.resume();
    } catch (e) {}
  });
  suspendedAudioContexts.length = 0;

  const mediaElements = document.querySelectorAll('audio, video');
  mediaElements.forEach((el) => {
    try {
      (el as HTMLMediaElement).play();
    } catch (e) {}
  });
}

// Global window event listener for messages from portal
function handlePortalMessage(event: MessageEvent) {
  // Origin check verification (P-002 §1.2)
  if (!allowedOrigins.includes(event.origin)) {
    return;
  }

  // Validate envelop properties
  const data = event.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return;
  if (data.source !== 'WGCP_PORTAL') return;

  const { id, type, payload, error } = data;

  // Handles dynamic lifecycle events (e.g. system menus)
  if (type === 'WGCP_PAUSE') {
    setState('PAUSED_OVERLAY');
    suspendAudioAndMedia();
    systemListeners.onPause.forEach(cb => cb());
    return;
  }

  if (type === 'WGCP_RESUME') {
    setState('READY_IDLE');
    resumeAudioAndMedia();
    const resumeContext = payload || { pausedDurationMs: 0, resumeTimestamp: Date.now() };
    systemListeners.onResume.forEach(cb => cb(resumeContext));
    return;
  }

  if (type === 'WGCP_SETTINGS_CHANGED') {
    currentSettings = { ...currentSettings, ...payload };
    systemListeners.onSettingsChanged.forEach(cb => cb(currentSettings));
    return;
  }

  if (type === 'WGCP_MIGRATION_ACK') {
    handleIdentityMigrationACK(payload.playerId);
    systemListeners.onPlayerChanged.forEach(cb => cb({ playerId: payload.playerId, isGuest: false }));
    return;
  }

  // Handle specialized queue/state resolutions
  if (type === 'WGCP_SAVE_ACK') {
    handleSaveACK(id, payload.revision);
    return;
  }

  if (type === 'WGCP_STATS_ACK') {
    handleStatsACK(id);
    return;
  }

  if (type === 'WGCP_CONFLICT_RESOLUTION') {
    handleConflictResolution(payload.choice, payload.serverState);
    return;
  }

  // Correlation promise matching
  const promise = pendingPromises.get(id);
  if (!promise) return;

  pendingPromises.delete(id);

  if (error) {
    promise.reject(error);
  } else {
    promise.resolve(payload);
  }
}

// Centralized isomorphic UUIDv4 generator checking browser/standard crypto libraries
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {}
  }
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    try {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40; // Version 4
      buf[8] = (buf[8] & 0x3f) | 0x80; // Variant 10xxxxxx
      const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    } catch (e) {}
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Send envelope API helper
export function sendRPCMessage<T = any>(type: string, payload: any): Promise<T> {
  return new Promise((resolve, reject) => {
    // Generate UUIDv4 correlation ID
    const correlationId = generateUUID();

    pendingPromises.set(correlationId, { resolve, reject });

    window.parent.postMessage({
      id: correlationId,
      type,
      source: 'WGCP_SDK',
      version: '2.0.0',
      payload
    }, portalOrigin);
  });
}

// Interceptor hook to track AudioContext creation
if (typeof window !== 'undefined') {
  try {
    const OriginalAudioContext = ((window as any).AudioContext || (window as any).webkitAudioContext);
    if (OriginalAudioContext) {
      const activeCtxs: AudioContext[] = [];
      (window as any)._activeAudioContexts = activeCtxs;

      const ProxyCtx = new Proxy(OriginalAudioContext, {
        construct(target, args: any[]) {
          const ctx = new target(...args);
          activeCtxs.push(ctx);
          return ctx;
        }
      });

      if ((window as any).AudioContext) (window as any).AudioContext = ProxyCtx;
      if ((window as any).webkitAudioContext) (window as any).webkitAudioContext = ProxyCtx;
    }
  } catch(e) {}
}

// WGCP Core namespace object
const WGCP = {
  getState: getState,
  init: function(options?: { allowedOrigins?: string[] }) {
    if (currentState !== 'UNINITIALIZED') {
      return Promise.resolve();
    }

    currentState = 'HANDSHAKING';

    // Parse configuration and URL origins
    const urlParams = new URLSearchParams(window.location.search);
    const originParam = urlParams.get('wgcp_origin');
    if (originParam) {
      portalOrigin = originParam;
      if (!allowedOrigins.includes(portalOrigin)) {
        allowedOrigins.push(portalOrigin);
      }
    }

    if (options?.allowedOrigins) {
      options.allowedOrigins.forEach(o => {
        if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
      });
    }

    gameId = urlParams.get('wgcp_game_id') || 'unknown';
    activePlayerId = urlParams.get('wgcp_player_id') || 'guest';

    // Listen to parent window messages
    window.addEventListener('message', handlePortalMessage);

    // Forward Escape keypresses to parent console to toggle the menu (P-004)
    if (typeof window !== 'undefined' && window.self !== window.top) {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          
          window.parent.postMessage({
            id: generateUUID(),
            type: 'WGCP_TOGGLE_MENU',
            source: 'WGCP_SDK',
            version: '2.0.0',
            payload: {}
          }, portalOrigin);
        }
      }, true); // Capturing phase
    }

    setupGamepadProxy();

    // Trigger storage initialization and handshake load
    return initStorage(gameId, activePlayerId)
      .then(() => initStats(gameId))
      .then(() => {
        // Send WGCP_INIT handshake, returns player details and cloud stats/revision
        return sendRPCMessage('WGCP_INIT', { gameId, playerId: activePlayerId });
      })
      .then((ackPayload: any) => {
        // Resolve settings and check version states
        if (ackPayload.settings) {
          currentSettings = { ...currentSettings, ...ackPayload.settings };
        }
        
        // Finalize state sync boot sequence (Section 2.2 of P-002)
        // Handled asynchronously in initStorage matching cases A-D
        return storageAPI.syncRevisions(ackPayload.cloudRevision, ackPayload.cloudState);
      })
      .then(() => {
        currentState = 'READY_IDLE';
      })
      .catch((err) => {
        currentState = 'UNINITIALIZED';
        window.removeEventListener('message', handlePortalMessage);
        throw err;
      });
  },

  storage: storageAPI,
  stats: statsAPI,
  identity: {
    getPlayer: function() {
      if (currentState === 'UNINITIALIZED') {
        return Promise.reject({ code: "ERROR_NOT_INITIALIZED", message: "SDK not initialized" });
      }
      return Promise.resolve({
        playerId: activePlayerId,
        displayName: activePlayerId.startsWith('guest') ? "Guest Player" : activePlayerId,
        isGuest: activePlayerId.startsWith('guest')
      });
    },
    onPlayerChanged: function(callback: (player: any) => void) {
      systemListeners.onPlayerChanged.push(callback);
    }
  },
  
  achievements: servicesAPI.achievements,
  leaderboards: servicesAPI.leaderboards,
  progression: servicesAPI.progression,

  system: {
    getSettings: function() {
      return currentSettings;
    },
    onSettingsChanged: function(callback: (settings: any) => void) {
      systemListeners.onSettingsChanged.push(callback);
    },
    onPause: function(callback: () => void) {
      systemListeners.onPause.push(callback);
    },
    onResume: function(callback: (ctx: any) => void) {
      systemListeners.onResume.push(callback);
    }
  },

  time: {
    getDelta: (function() {
      let lastTime = Date.now();
      return function(currentTime?: number) {
        const now = currentTime || Date.now();
        let delta = (now - lastTime) / 1000;
        lastTime = now;

        // Clamp maximum frame delta to prevent physics explosions (P-003 §3.4)
        if (delta > 0.1) delta = 0.1;
        if (delta < 0) delta = 0;
        return delta;
      };
    })()
  },

  telemetry: {
    reportPerformance: function(fps: number, memoryUsage?: number) {
      // Fire and forget performance logging
      window.parent.postMessage({
        type: 'WGCP_TELEMETRY_PERF',
        source: 'WGCP_SDK',
        version: '2.0.0',
        payload: { fps, memoryUsage, timestamp: Date.now() }
      }, portalOrigin);
    }
  }
};

if (typeof window !== 'undefined') {
  (window as any).WGCP = WGCP;
}

export const init = WGCP.init;
export const storage = WGCP.storage;
export const stats = WGCP.stats;
export const identity = WGCP.identity;
export const achievements = WGCP.achievements;
export const leaderboards = WGCP.leaderboards;
export const progression = WGCP.progression;
export const system = WGCP.system;
export const time = WGCP.time;
export const telemetry = WGCP.telemetry;

export default WGCP;
export { activePlayerId };
