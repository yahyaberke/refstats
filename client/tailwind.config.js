/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#060b16',
          900: '#0a1120',
          850: '#0e1729',
          800: '#121d33',
          700: '#1a2742',
          600: '#243453',
          500: '#344769',
        },
        pitch: {
          50: '#ebfdf3',
          100: '#cefae1',
          200: '#a0f2c8',
          300: '#63e5a8',
          400: '#2fd08a',
          500: '#12b571',
          600: '#08935c',
          700: '#09754c',
        },
        card: {
          yellow: '#facc15',
          red: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(47,208,138,.25), 0 8px 30px -12px rgba(18,181,113,.45)',
        panel: '0 1px 0 0 rgba(255,255,255,.04) inset, 0 12px 32px -18px rgba(0,0,0,.6)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
      },
    },
  },
  plugins: [],
};
