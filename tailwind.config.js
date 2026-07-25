/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './public/**/*.html',
    './public/**/*.js',
    './functions/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f3f5f9', 100: '#e1e7f1', 200: '#c3d0e3', 300: '#9cb3d1',
          400: '#6c8fba', 500: '#416d9d', 600: '#305580', 700: '#254267',
          800: '#1d3552', 900: '#192e45', 950: '#101e2d',
        },
        secondary: {
          50: '#fdf8f3', 100: '#f6ede1', 200: '#ead6ba', 300: '#dfc19a',
          400: '#d2aa79', 500: '#b88d58', 600: '#a17546', 700: '#835b36',
          800: '#6b492c', 900: '#5a3e26', 950: '#2f1f13',
        },
        accent: {
          50: '#f2faf6', 100: '#d9f0e5', 200: '#b4dfcb', 300: '#89caa9',
          400: '#61b48a', 500: '#3c976d', 600: '#2e7755', 700: '#265c44',
          800: '#204b38', 900: '#1b3e30', 950: '#0e221b',
        },
      },
      fontFamily: { sans: ['Noto Sans SC', 'sans-serif'] },
    }
  },
  plugins: []
}
