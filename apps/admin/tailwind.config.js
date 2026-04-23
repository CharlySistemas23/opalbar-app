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
        },
        success: '#38C793',
        danger: '#E45858',
        card: '#17171B',
        elevated: '#1F1F25',
        line: '#2A2A32',
        muted: '#6B6B78',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
