import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Política de segurança de conteúdo (CSP), só no build de produção — no `vite
 * dev` o HMR usa scripts inline e WebSocket que ela bloquearia.
 *
 * Limita para onde o site pode mandar dados e de onde carrega código: se
 * alguém conseguir injetar um script, ele não roda (script-src só do próprio
 * site) nem consegue enviar nada para um servidor desconhecido (connect-src
 * lista os destinos reais). GitHub Pages não deixa configurar cabeçalhos, por
 * isso vai em <meta>; `frame-ancestors` não funciona assim e fica de fora.
 *
 * Se um serviço novo for usado (outro provedor de mapa, outra API), ele
 * precisa entrar aqui — senão o navegador o bloqueia e o Console mostra
 * "Refused to connect".
 */
function politicaDeSeguranca(urlSupabase) {
  const supabase = urlSupabase ? [urlSupabase, urlSupabase.replace(/^https:/, 'wss:')] : []
  const diretivas = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    // 'unsafe-inline': o Leaflet e o React posicionam elementos por style="".
    'style-src': ["'self'", "'unsafe-inline'"],
    // data: porque o Vite embute a fonte menor no CSS em vez de um arquivo.
    'font-src': ["'self'", 'data:'],
    // Tiles de mapa e miniaturas vêm de vários hosts https; imagem é de baixo risco.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'connect-src': [
      "'self'",
      ...supabase,
      'https://nominatim.openstreetmap.org',
      'https://www.dgi.inpe.br',
      'https://services.arcgisonline.com',
    ],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  }
  return Object.entries(diretivas)
    .map(([nome, valores]) => `${nome} ${valores.join(' ')}`)
    .join('; ')
}

// base absoluto: o site é servido em https://luccaschettino-lab.github.io/analisar-solo-web/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    base: '/analisar-solo-web/',
    plugins: [
      react(),
      {
        name: 'csp-no-build',
        apply: 'build',
        transformIndexHtml: () => [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: politicaDeSeguranca(env.VITE_SUPABASE_URL),
            },
            injectTo: 'head-prepend',
          },
        ],
      },
    ],
    build: {
      // Sem source maps: o F12 mostra só o JS minificado, sem os arquivos e
      // comentários originais. É o padrão do Vite; fica explícito para ninguém
      // ligar por engano.
      sourcemap: false,
      rolldownOptions: {
        output: {
          // Console e debugger saem do build de produção: nada de mensagem
          // interna (nem de biblioteca) aparecendo na aba Console.
          minify: { compress: { dropConsole: true, dropDebugger: true } },
        },
      },
    },
  }
})
