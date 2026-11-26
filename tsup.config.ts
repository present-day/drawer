import { readFile, writeFile } from 'node:fs/promises'
import { defineConfig } from 'tsup'

// Only `index` is public. The others draw chunk boundaries: each engine and
// the code they share get a chunk of their own, and `index` only re-exports
// them, so a bundler drops the v2 engine when an app doesn't use
// `LegacyDrawer`.
const ENTRIES = ['index', 'scroll', 'legacy', 'core']

export default defineConfig({
  entry: Object.fromEntries(ENTRIES.map((name) => [name, `src/${name}.ts`])),
  format: ['cjs', 'esm'],
  // Shared modules (the body-lock count, the handle) land in one chunk both
  // engines import, so an app using both keeps one copy of that state.
  splitting: true,
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'motion'],
  loader: {
    // `.css` is handled by tsup's PostCSS plugin as global `css`, which strips CSS module exports.
    '.pcss': 'local-css',
  },
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
  // esbuild emits index.css next to the JS but does not import it; link it so
  // app bundlers load the styles. It holds both engines' styles.
  async onSuccess() {
    for (const name of ['index']) {
      for (const [ext, line] of [
        ['mjs', `import "./${name}.css";\n`],
        ['js', `require("./${name}.css");\n`],
      ]) {
        const file = `dist/${name}.${ext}`
        const code = await readFile(file, 'utf8')
        if (!code.startsWith(line)) await writeFile(file, line + code)
      }
    }
  },
})
