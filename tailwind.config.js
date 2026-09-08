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
      fontFamily: {
        // Só a marca "Boss-Agro" na tela de login usa isto — o resto do app
        // fica na fonte do sistema, que é o que uma tela densa de dados pede.
        marca: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        // Marcador de amostra "vivo" na ilustração do login — o único
        // movimento da tela, e para sozinho para quem pede menos animação.
        pulso: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'pulso-anel': {
          '0%': { transform: 'scale(1)', opacity: '0.9' },
          '100%': { transform: 'scale(2.8)', opacity: '0' },
        },
      },
      animation: {
        pulso: 'pulso 2.6s ease-in-out infinite',
        'pulso-anel': 'pulso-anel 2.6s ease-out infinite',
      },
    },
  },
  plugins: [],
}
