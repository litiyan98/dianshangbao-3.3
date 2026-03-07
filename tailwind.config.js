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
        'liquid-flow': 'liquidFlow 20s ease infinite',
        'rainbow': 'rainbowSweep 3s linear infinite',
        'fade-in-up': 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        shimmer: 'shimmer 2s linear infinite',
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
        liquidFlow: {
          '0%, 100%': {
            backgroundSize: '400% 400%',
            backgroundPosition: '0% 50%',
          },
          '50%': {
            backgroundSize: '400% 400%',
            backgroundPosition: '100% 50%',
          },
        },
        rainbowSweep: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
