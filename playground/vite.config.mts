import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { postcssModulesPcssPlugin } from './vite-pcss'

const playgroundRoot = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceEntry = fileURLToPath(new URL('../src/index.ts', import.meta.url))

// GitHub Pages serves the site from a subpath; relative base in production
// makes chunk URLs work. Dev server keeps "/" so HMR and module resolution behave.
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : './',
  root: playgroundRoot,
  plugins: [react(), postcssModulesPcssPlugin()],
  resolve: {
    alias: {
      '@present-day/drawer': sourceEntry,
    },
    dedupe: ['react', 'react-dom', 'motion'],
  },
  server: {
    port: 5173,
    fs: {
      allow: [playgroundRoot, packageRoot],
    },
  },
}))
