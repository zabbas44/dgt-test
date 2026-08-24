import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Bundles the whole app into one classic (IIFE) script so the offline
// single-file build can run straight from the file system, where ES modules
// and fetch() are blocked by the browser.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'build-offline',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: { entry: 'src/main.jsx', name: 'DGTApp', formats: ['iife'], fileName: () => 'app.js' },
  },
})
