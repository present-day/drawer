import { readFile, writeFile } from 'node:fs/promises'
import { defineConfig } from 'tsup'

const ENTRIES = ['index', 'legacy']

export default defineConfig({
  entry: Object.fromEntries(ENTRIES.map((name) => [name, `src/${name}.ts`])),
  format: ['cjs', 'esm'],
  // Shared modules (the body-lock count, the handle) land in one chunk both
  // entries import, so an app using both engines keeps one copy of that state.
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
  // esbuild emits each entry's CSS next to its JS but does not import it; link
  // it so app bundlers load the styles.
  async onSuccess() {
    for (const name of ENTRIES) {
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
