/** @type {import('tailwindcss').Config} */
export default {
  // Classe 'dark' no <html>, ligada pelo ThemeContext — não a preferência do
  // SO. O tema é uma escolha da pessoa, guardada e alternável na hora.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // verde base usado como cor padrão de talhão (talhoes.cor)
        solo: {
          50: '#f1f8f2',
          100: '#dcedde',
          // 300/400 completam a escala para texto/ícone verde sobre fundo
          // escuro (chrome técnico) — o conjunto original pulava de 100 a 500.
          300: '#81c784',
          400: '#66bb6a',
          500: '#4caf50',
          600: '#3d8b40',
          700: '#2e7d32',
          800: '#245e27',
          900: '#1b451d',
        },
        // Azul-noite do chrome do app: header, barra lateral e painéis
        // flutuantes sobre o mapa. Substitui o branco/cinza-claro anterior.
        noite: {
          950: '#050b16',
          900: '#0a1526',
          800: '#101f36',
          700: '#182c48',
          600: '#24406b',
          500: '#375c8f',
        },
      },
      boxShadow: {
        painel: '0 12px 40px -16px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
}
