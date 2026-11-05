/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#2D6A4F',
          800: '#1B4332',
          900: '#081C15',
        },
        surface: {
          50: '#FAFBFB',
          100: '#F4F5F6',
          200: '#E9EBEF',
          300: '#DDE0E5',
          800: '#1E293B',
          900: '#0F172A',
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(15, 23, 42, 0.08)',
        'elevated': '0 12px 36px -4px rgba(27, 67, 50, 0.16)',
      }
    },
  },
  plugins: [],
}
