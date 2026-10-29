import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base absoluto: o site é servido em https://luccaschettino-lab.github.io/analisar-solo-web/
export default defineConfig({
  base: '/analisar-solo-web/',
  plugins: [react()],
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
})
