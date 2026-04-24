import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import postcss from 'postcss'
import postcssModules from 'postcss-modules'
import type { Plugin } from 'vite'

const PREFIX = '\0drawer-pcss:'

const toKey = (abs: string) => Buffer.from(abs, 'utf8').toString('base64url')
const fromKey = (b64: string) => Buffer.from(b64, 'base64url').toString('utf8')

/**
 * tsup uses `.module.pcss` (CSS modules) for the handle; Vite would otherwise
 * send the file to its CSS pipeline. We resolve to a virtual module that exports
 * scoped class names and injects the emitted CSS. The virtual id must not
 * contain `.pcss` or Vite applies the CSS transform to our emitted JS.
 */
export function postcssModulesPcssPlugin(): Plugin {
  return {
    name: 'postcss-modules-pcss',
    enforce: 'pre',
    async resolveId(id, importer) {
      if (id.startsWith(PREFIX)) return null
      if (!id.includes('.module.pcss') || id.includes('?')) return null
      const resolved = await this.resolve(id, importer, { skipSelf: true })
      if (!resolved) return null
      return PREFIX + toKey(resolved.id)
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) return null
      const filePath = fromKey(id.slice(PREFIX.length))
      const source = await readFile(filePath, 'utf-8')
      let modulesJson: Record<string, string> = {}
      const result = await postcss([
        postcssModules({
          getJSON: (_f, j) => {
            modulesJson = j
          },
        }),
      ]).process(source, { from: filePath })
      return `const css = ${JSON.stringify(result.css)};

const s = document.createElement('style');
s.setAttribute('data-drawer-pcss', ${JSON.stringify(pathToFileURL(filePath).href)});
s.textContent = css;
document.head.appendChild(s);

export default ${JSON.stringify(modulesJson)};
`
    },
  }
}
