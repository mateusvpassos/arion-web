import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base relativa p/ funcionar em GitHub Pages (subpasta) e local.
// porta 4173 = origem já autorizada no OAuth Client Web ("Cifras").
export default defineConfig({
  plugins: [vue()],
  base: './',
  server: { port: 4173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
