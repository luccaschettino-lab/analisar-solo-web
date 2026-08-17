/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // verde base usado como cor padrão de talhão (talhoes.cor)
        solo: {
          50: '#f1f8f2',
          100: '#dcedde',
          500: '#4caf50',
          600: '#3d8b40',
          700: '#2e7d32',
          800: '#245e27',
          900: '#1b451d',
        },
      },
    },
  },
  plugins: [],
}
