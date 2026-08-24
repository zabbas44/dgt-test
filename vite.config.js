import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps every asset path relative, so `dist/index.html`
// can be opened straight from the file system without a web server.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', assetsDir: 'assets', chunkSizeWarningLimit: 1500 },
})
