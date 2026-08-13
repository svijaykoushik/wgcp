/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0c14',
        'bg-secondary': '#121624',
        'card-bg': 'rgba(22, 28, 48, 0.7)',
        'card-border': 'rgba(255, 255, 255, 0.08)',
        'card-hover-border': 'rgba(99, 102, 241, 0.4)',
        'accent-purple': '#818cf8',
        'accent-cyan': '#38bdf8',
        'accent-green': '#34d399',
        'accent-orange': '#fb923c',
        'text-main': '#f1f5f9',
        'text-muted': '#94a3b8',
        'focus-ring': '#818cf8',
        'focus-glow': 'rgba(129, 140, 248, 0.35)',
      },
      fontSize: {
        'fluid-xs': 'clamp(0.75rem, 0.6rem + 0.5vw, 1rem)',
        'fluid-sm': 'clamp(0.875rem, 0.7rem + 0.6vw, 1.25rem)',
        'fluid-base': 'clamp(1rem, 0.85rem + 0.7vw, 1.5rem)',
        'fluid-lg': 'clamp(1.125rem, 0.9rem + 0.9vw, 1.875rem)',
        'fluid-xl': 'clamp(1.25rem, 1rem + 1.1vw, 2.25rem)',
        'fluid-2xl': 'clamp(1.5rem, 1.1rem + 1.5vw, 3rem)',
        'fluid-3xl': 'clamp(1.875rem, 1.3rem + 2vw, 3.75rem)',
      },
      spacing: {
        'safe': '5vmin',
        'safe-x': '5vw',
        'safe-y': '5vh',
      },
      screens: {
        'xs': '360px',
        'console': '1280px',
        '2k': '1920px',
        '4k': '2560px',
      },
      animation: {
        'focus-pulse': 'focusPulse 1.5s ease-in-out infinite',
        'focus-scale': 'focusScale 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'card-enter': 'cardEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'view-enter-right': 'viewEnterRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'view-enter-left': 'viewEnterLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'view-exit-right': 'viewExitRight 0.25s ease-in both',
        'view-exit-left': 'viewExitLeft 0.25s ease-in both',
        'launch-expand': 'launchExpand 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        'launch-backdrop': 'launchBackdrop 0.6s ease-out both',
        'launch-iframe-reveal': 'launchIframeReveal 0.4s ease-out 0.6s both',
        'press-down': 'pressDown 0.1s ease-out forwards',
        'press-up': 'pressUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'overlay-enter': 'overlayEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'overlay-backdrop': 'overlayBackdrop 0.3s ease-out both',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'bg-drift': 'bgDrift 20s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.3s ease-out both',
        'fade-in-up': 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        focusPulse: {
          '0%, 100%': { boxShadow: '0 0 0 2px var(--tw-shadow-color, rgba(129, 140, 248, 0.35))' },
          '50%': { boxShadow: '0 0 0 6px var(--tw-shadow-color, rgba(129, 140, 248, 0.15))' },
        },
        focusScale: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.04)' },
        },
        cardEnter: {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        viewEnterRight: {
          '0%': { opacity: '0', transform: 'translateX(60px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        viewEnterLeft: {
          '0%': { opacity: '0', transform: 'translateX(-60px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        viewExitRight: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(60px)' },
        },
        viewExitLeft: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-60px)' },
        },
        launchExpand: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '40%': { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '0', transform: 'scale(1.5)', filter: 'blur(8px)' },
        },
        launchBackdrop: {
          '0%': { opacity: '0', backdropFilter: 'blur(0px)' },
          '100%': { opacity: '1', backdropFilter: 'blur(20px)' },
        },
        launchIframeReveal: {
          '0%': { opacity: '0', transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pressDown: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(0.95)' },
        },
        pressUp: {
          '0%': { transform: 'scale(0.95)' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
        overlayEnter: {
          '0%': { opacity: '0', transform: 'scale(0.92) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        overlayBackdrop: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bgDrift: {
          '0%': { backgroundPosition: '15% 20%, 85% 70%' },
          '50%': { backgroundPosition: '25% 40%, 75% 50%' },
          '100%': { backgroundPosition: '20% 30%, 80% 60%' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
