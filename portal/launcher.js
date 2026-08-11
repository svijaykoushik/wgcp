/**
 * Game Console Launcher Module
 * Handles loading games inside a full-screen viewport, managing focus routing,
 * and presenting a decoupled system overlay for session control.
 */
(function (global) {
  'use strict';

  const GameLauncher = {
    container: null,
    iframe: null,
    overlayEl: null,
    titleEl: null,
    iconEl: null,
    genreEl: null,
    libraryView: null,
    currentGame: null,
    focusTimers: [],
    isClosing: false,

    /**
     * Initialize launcher DOM references and listeners.
     */
    init() {
      this.container = document.getElementById('launcher-screen');
      this.iframe = document.getElementById('game-iframe');
      this.overlayEl = document.getElementById('system-overlay');
      this.titleEl = document.getElementById('system-game-title');
      this.iconEl = document.getElementById('system-game-icon');
      this.genreEl = document.getElementById('system-game-genre');
      this.libraryView = document.getElementById('library-view');

      // System Menu Trigger Button
      const menuTrigger = document.getElementById('system-menu-trigger');
      if (menuTrigger) {
        menuTrigger.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleOverlay();
        });
      }

      // Resume button inside System Overlay
      const resumeBtn = document.getElementById('system-resume-btn');
      if (resumeBtn) {
        resumeBtn.addEventListener('click', () => this.resume());
      }

      // Exit button inside System Overlay
      const exitBtn = document.getElementById('system-exit-btn');
      if (exitBtn) {
        exitBtn.addEventListener('click', () => this.close());
      }

      // Intercept Escape key for system overlay toggle
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) {
          if (this.isOverlayOpen()) {
            this.resume();
          } else {
            this.openOverlay();
          }
        }
      });

      // Intercept Fullscreen change events
      const handleFullscreenChange = () => {
        if (this.isOpen() && !this.isFullscreen() && !this.isClosing) {
          // When user exits fullscreen (e.g. via browser ESC), reveal decoupled system menu
          this.openOverlay();
        }
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('MSFullscreenChange', handleFullscreenChange);

      // Asynchronously direct input focus upon iframe loading
      if (this.iframe) {
        this.iframe.addEventListener('load', () => {
          if (this.isOpen() && !this.isOverlayOpen()) {
            this.scheduleAsyncFocus();
          }
        });
      }
    },

    /**
     * Check if fullscreen mode is active across vendor prefixes.
     * @returns {boolean}
     */
    isFullscreen() {
      return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
    },

    /**
     * Request full-screen expansion using HTML5 Fullscreen API.
     */
    async requestFullscreen() {
      const el = this.container || document.documentElement;
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el.mozRequestFullScreen) {
          await el.mozRequestFullScreen();
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen();
        }
      } catch (err) {
        console.warn('GameLauncher: Fullscreen request declined or unsupported:', err);
      }
    },

    /**
     * Exit full-screen mode safely across vendor prefixes.
     */
    async exitFullscreen() {
      if (!this.isFullscreen()) return;
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      } catch (err) {
        console.warn('GameLauncher: Error exiting fullscreen:', err);
      }
    },

    /**
     * Direct hardware inputs directly to the active iframe window.
     */
    focusIframe() {
      if (!this.iframe || !this.isOpen() || this.isOverlayOpen()) return;
      try {
        this.iframe.focus();
        if (this.iframe.contentWindow) {
          this.iframe.contentWindow.focus();
        }
      } catch (e) {
        // Cross-origin access warnings can be ignored for focus()
        this.iframe.focus();
      }
    },

    /**
     * Asynchronous focus-shifting sequence ensuring canvas elements gain immediate focus.
     */
    scheduleAsyncFocus() {
      this.clearFocusTimers();

      // Immediate frame focus
      requestAnimationFrame(() => this.focusIframe());

      // Progressive interval focus sequence to capture lazy-loaded canvases
      const delays = [50, 150, 300, 600, 1200];
      delays.forEach((delay) => {
        const timer = setTimeout(() => this.focusIframe(), delay);
        this.focusTimers.push(timer);
      });
    },

    /**
     * Clear all pending focus timers.
     */
    clearFocusTimers() {
      this.focusTimers.forEach((t) => clearTimeout(t));
      this.focusTimers = [];
    },

    /**
     * Resolve the target URL from game metadata.
     * @param {Object} game - Game metadata object from the registry
     * @returns {string} Target URL
     */
    resolveUrl(game) {
      if (game.url) {
        return game.url;
      }
      if (game.hosting && game.hosting.hostname) {
        return `http://${game.hosting.hostname}`;
      }
      if (game.id) {
        return `http://${game.id}.localhost`;
      }
      return '';
    },

    /**
     * Check if a game launcher screen is currently active.
     * @returns {boolean}
     */
    isOpen() {
      return this.container && !this.container.classList.contains('hidden');
    },

    /**
     * Check if the decoupled system overlay is open.
     * @returns {boolean}
     */
    isOverlayOpen() {
      return this.overlayEl && !this.overlayEl.classList.contains('hidden');
    },

    /**
     * Reveal decoupled system menu overlay.
     */
    openOverlay() {
      if (this.overlayEl) {
        this.overlayEl.classList.remove('hidden');
      }
    },

    /**
     * Hide decoupled system menu overlay.
     */
    closeOverlay() {
      if (this.overlayEl) {
        this.overlayEl.classList.add('hidden');
      }
    },

    /**
     * Toggle decoupled system menu overlay.
     */
    toggleOverlay() {
      if (this.isOverlayOpen()) {
        this.resume();
      } else {
        this.openOverlay();
      }
    },

    /**
     * Resume active game session, entering fullscreen and re-routing focus.
     */
    async resume() {
      this.closeOverlay();
      if (!this.isFullscreen()) {
        await this.requestFullscreen();
      }
      this.scheduleAsyncFocus();
    },

    /**
     * Launch a game in full-screen mode with async focus routing.
     * @param {Object} game - Game metadata object from the registry
     */
    async launch(game) {
      if (!game) return;

      const url = this.resolveUrl(game);
      if (!url) {
        console.error('Launcher: Unable to determine game URL for', game);
        return;
      }

      this.isClosing = false;
      this.currentGame = game;
      const meta = game.metadata || {};

      // Update system overlay metadata
      if (this.titleEl) {
        this.titleEl.textContent = game.name || game.id;
      }
      if (this.iconEl) {
        this.iconEl.textContent = meta.icon || '🎮';
      }
      if (this.genreEl) {
        this.genreEl.textContent = meta.genre || 'HTML5 Game';
      }

      // Hide overlay initially
      this.closeOverlay();

      // Load game URL inside iframe
      if (this.iframe) {
        this.iframe.src = url;
      }

      // Switch views to full-screen launcher container
      if (this.libraryView) {
        this.libraryView.classList.add('hidden');
      }
      if (this.container) {
        this.container.classList.remove('hidden');
      }

      document.body.classList.add('launcher-active');

      // Request browser fullscreen expansion
      await this.requestFullscreen();

      // Trigger asynchronous input focus sequence
      this.scheduleAsyncFocus();
    },

    /**
     * Safely tear down the active game session and return to library catalog.
     */
    async close() {
      this.isClosing = true;
      this.clearFocusTimers();

      // Reset iframe to halt runtime loops and audio immediately
      if (this.iframe) {
        this.iframe.src = 'about:blank';
      }

      this.currentGame = null;
      this.closeOverlay();

      // Exit fullscreen mode if active
      await this.exitFullscreen();

      // Switch views back to library
      if (this.container) {
        this.container.classList.add('hidden');
      }
      if (this.libraryView) {
        this.libraryView.classList.remove('hidden');
      }

      document.body.classList.remove('launcher-active');
      this.isClosing = false;
    }
  };

  // Expose to window
  global.GameLauncher = GameLauncher;

})(typeof window !== 'undefined' ? window : this);
