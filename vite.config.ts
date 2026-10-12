import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base relativa p/ funcionar em GitHub Pages (subpasta) e local.
// porta 4173 = origem já autorizada no OAuth Client Web ("Cifras").
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    rollupOptions: {
      // login-desktop.html: aberta no navegador pelo MyMusic desktop
      input: { main: 'index.html', login: 'login-desktop.html' },
    },
  },
  server: { port: 4173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
