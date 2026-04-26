import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    watch: false,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/index.ts',
        'src/types.ts',
        // Not a coverage focus: mobile keyboard snap, visual viewport, motion-heavy root.
        'src/hooks/useDrawerKeyboardSnapMobile.ts',
        'src/hooks/useVisualViewport.ts',
        'src/components/Drawer.tsx',
      ],
      thresholds: {
        lines: 50,
        statements: 50,
        functions: 50,
        branches: 50,
      },
    },
  },
})
