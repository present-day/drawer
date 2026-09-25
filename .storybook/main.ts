import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'
import { postcssModulesPcssPlugin } from './vite-pcss'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  // The drawer imports `.module.pcss` (the extension tsup needs for CSS
  // modules). Route those through the same PostCSS-modules transform the
  // package build uses, so the handle and keyboard backfill styles render.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [
      ...(viteConfig.plugins ?? []),
      postcssModulesPcssPlugin(),
      // The drawer and the stories are styled with Tailwind (see stories/tailwind.css).
      tailwindcss(),
    ],
    resolve: {
      ...viteConfig.resolve,
      dedupe: ['react', 'react-dom', 'motion'],
    },
    build: {
      ...viteConfig.build,
      // Browsers with native `light-dark()`. Older targets make the CSS
      // minifier rewrite it into variables keyed off a stylesheet
      // `color-scheme`, which the Theme toolbar's inline scheme never sets.
      cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'],
    },
  }),
}

export default config
