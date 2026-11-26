import { describe, expect, it } from 'vitest'

import * as root from './index'
import * as legacy from './legacy'

describe('entry points', () => {
  it('keeps the v2 engine out of the root entry', () => {
    for (const name of [
      'LegacyDrawer',
      'LegacyDrawerContent',
      'LegacyDrawerScrollable',
      'useDrawerContext',
      'useDrawerDrag',
      'useDrawerSnap',
      'SPRING_CONFIG',
    ]) {
      expect(root).not.toHaveProperty(name)
      expect(legacy).toHaveProperty(name)
    }
  })

  it('shares the body-lock state between entries', async () => {
    const utils = await import('./utils')
    expect(root.lockBody).toBe(utils.lockBody)
  })
})
