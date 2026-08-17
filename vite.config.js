import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base absoluto: o site é servido em https://luccaschettino-lab.github.io/analisar-solo-web/
export default defineConfig({
  base: '/analisar-solo-web/',
  plugins: [react()],
})
