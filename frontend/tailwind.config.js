/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        kiosk: {
          bg: '#0f172a',
          card: '#1e293b',
          accent: '#38bdf8',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
      },
      fontSize: {
        kiosk: ['1.25rem', { lineHeight: '1.75rem' }],
        'kiosk-lg': ['1.75rem', { lineHeight: '2.25rem' }],
        'kiosk-xl': ['2.25rem', { lineHeight: '2.75rem' }],
      },
    },
  },
  plugins: [],
}
