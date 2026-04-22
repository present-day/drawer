import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'motion'],
  // esbuild emits `index.css` next to JS but does not add an import; link it so app bundlers load styles.
  banner: ({ format }) =>
    format === 'esm'
      ? { js: 'import "./index.css";' }
      : { js: 'require("./index.css");' },
  loader: {
    // `.css` is handled by tsup's PostCSS plugin as global `css`, which strips CSS module exports.
    '.pcss': 'local-css',
  },
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
})
