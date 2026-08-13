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
      },
    },
  },
  plugins: [],
}
