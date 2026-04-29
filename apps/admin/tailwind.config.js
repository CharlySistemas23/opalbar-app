/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#F4A340',
          soft: '#F4A34020',
          dark: '#C97D1F',
        },
        success: { DEFAULT: '#38C793', soft: '#38C79320' },
        danger:  { DEFAULT: '#E45858', soft: '#E4585820' },
        warning: { DEFAULT: '#EAB04A', soft: '#EAB04A20' },
        info:    { DEFAULT: '#60A5FA', soft: '#60A5FA20' },
        bgPrimary: '#0B0B0E',
        surface: '#101015',
        card: '#17171B',
        elevated: '#1F1F25',
        line: '#2A2A32',
        muted: '#6B6B78',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.20), 0 4px 16px rgba(0,0,0,0.30)',
        glow: '0 0 0 1px rgba(244,163,64,0.15), 0 4px 24px rgba(244,163,64,0.10)',
        ring: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      },
      backgroundImage: {
        'page-grad': 'radial-gradient(1200px 600px at 0% -10%, rgba(244,163,64,0.06), transparent 60%), radial-gradient(800px 500px at 100% 0%, rgba(96,165,250,0.04), transparent 60%)',
        'header-grad': 'linear-gradient(180deg, rgba(244,163,64,0.06) 0%, rgba(244,163,64,0) 100%)',
        'card-grad': 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
      },
      keyframes: {
        'fade-in':   { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'shimmer':   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-soft':{ '0%,100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'shimmer': 'shimmer 1.4s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
