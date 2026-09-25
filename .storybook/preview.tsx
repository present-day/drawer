import type { Decorator, Preview } from '@storybook/react-vite'
import { useLayoutEffect } from 'react'

import '../stories/tailwind.css'
import './preview.css'

type Theme = 'light' | 'dark' | 'system'

/**
 * Sets `color-scheme` the same way a host app would. It goes on the root
 * element as well as the story surface: the drawer portals to
 * `document.body`, so a scheme set only on the wrapper would not reach it.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme ?? 'system') as Theme
  const colorScheme = theme === 'system' ? 'light dark' : theme
  useLayoutEffect(() => {
    document.documentElement.style.colorScheme = colorScheme
  }, [colorScheme])
  return (
    <div className="sb-surface" style={{ colorScheme }}>
      <Story />
    </div>
  )
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'system', title: 'System', icon: 'browser' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'system' },
  decorators: [withTheme],
  parameters: { layout: 'fullscreen' },
}

export default preview
