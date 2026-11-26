import { describe, expect, it } from 'vitest'

import * as core from './core'
import * as root from './index'
import * as legacy from './legacy'

describe('build entries', () => {
  it('keeps every v2 export on the root', () => {
    expect(root.LegacyDrawer).toBe(legacy.LegacyDrawer)
    expect(root.LegacyDrawerContent).toBe(legacy.LegacyDrawerContent)
    expect(root.LegacyDrawerScrollable).toBe(legacy.LegacyDrawerScrollable)
    expect(root.useDrawerContext).toBe(legacy.useDrawerContext)
    expect(root.useDrawerDrag).toBe(legacy.useDrawerDrag)
  })

  it('shares the body-lock state between engines', () => {
    expect(root.lockBody).toBe(core.lockBody)
    expect(root.getLockCount).toBe(core.getLockCount)
  })
})
