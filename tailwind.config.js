import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  // Classe 'dark' no <html>, ligada pelo ThemeContext — não a preferência do
  // SO. O tema é uma escolha da pessoa, guardada e alternável na hora.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Azul da marca (Moinho) — calibrado a partir dos tons reais do
        // logo (as pás e o wordmark), não escolhido de olho. Era verde
        // ("solo" = terra) até a troca de marca; o nome do token ficou pra
        // não reescrever as classes em 34 arquivos, mas o valor agora é
        // este azul — pense nele como "cor de ação/marca", não "verde".
        solo: {
          50: '#eef6fc',
          100: '#d6ebf7',
          300: '#7ec1e8',
          400: '#4aa3d9',
          500: '#2f8cc9',
          600: '#1f72ab',
          700: '#175a87',
          800: '#12456a',
          900: '#0c2f49',
        },
        // Azul-noite do chrome do app: header, barra lateral e painéis
        // flutuantes sobre o mapa. Já nasceu na família de azul da marca —
        // não precisou mudar com a troca de identidade.
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
        // Entrada única do diálogo — não repete, não chama atenção sozinha,
        // só marca "isto acabou de aparecer".
        'modal-entrada': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        pulso: 'pulso 2.6s ease-in-out infinite',
        'pulso-anel': 'pulso-anel 2.6s ease-out infinite',
        'modal-entrada': 'modal-entrada 0.18s ease-out',
      },
    },
  },
  plugins: [],
}
