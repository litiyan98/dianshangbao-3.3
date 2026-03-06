/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./functions/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gemini: {
          blue: '#4F8AFA',
          purple: '#A87FFB',
          pink: '#F871A0',
        },
        orange: {
          500: '#F97316',
          600: '#EA580C',
        },
      },
      animation: {
        'gradient-x': 'gradient-x 3s ease infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            backgroundSize: '200% 200%',
            backgroundPosition: 'left center',
          },
          '50%': {
            backgroundSize: '200% 200%',
            backgroundPosition: 'right center',
          },
        },
        'pulse-glow': {
          '0%, 100%': {
            opacity: 1,
            filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))',
          },
          '50%': {
            opacity: 0.6,
            filter: 'drop-shadow(0 0 2px rgba(168, 85, 247, 0.2))',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
}
