import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DRAWER_CONTEXT_CONSUMER } from './constants'
import { useDrawerContext } from './context'

function Consumer() {
  useDrawerContext(DRAWER_CONTEXT_CONSUMER.Content)
  return null
}

describe('useDrawerContext', () => {
  it('throws when used outside Drawer', () => {
    expect(() => render(<Consumer />)).toThrow(
      'Drawer.Content must be used within Drawer',
    )
  })
})
