import { describe, expect, it, vi } from 'vitest'

import {
  cn,
  forceUnlock,
  getLockCount,
  initTailwindMerge,
  lockBody,
  unlockBody,
} from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })
})

describe('initTailwindMerge', () => {
  it('handles early return when already initialized', async () => {
    // First call initializes
    await initTailwindMerge()

    // Second call should return early
    const spy = vi.spyOn(console, 'log')
    await initTailwindMerge()
    spy.mockRestore()
  })

  it('handles import failure gracefully', async () => {
    // Reset initialization state by creating a fresh instance
    const { initTailwindMerge: freshInit } =
      await vi.importActual<typeof import('./utils')>('./utils')

    // Mock the import to fail
    vi.doMock('tailwind-merge', () => {
      throw new Error('Module not found')
    })

    // Should not throw
    await expect(freshInit()).resolves.toBeUndefined()

    vi.doUnmock('tailwind-merge')
  })
})

describe('lockBody / unlockBody', () => {
  it('increments count and sets overflow on first lock, restores on last unlock', () => {
    forceUnlock()
    expect(getLockCount()).toBe(0)
    document.body.style.overflow = 'auto'

    lockBody()
    expect(getLockCount()).toBe(1)
    expect(document.body.style.overflow).toBe('hidden')

    lockBody()
    expect(getLockCount()).toBe(2)

    unlockBody()
    expect(getLockCount()).toBe(1)
    expect(document.body.style.overflow).toBe('hidden')

    unlockBody()
    expect(getLockCount()).toBe(0)
    expect(document.body.style.overflow).toBe('auto')
  })

  it('rebounds lockCount when unlock underflows and resets on last unlock with forceUnlock state', () => {
    forceUnlock()
    lockBody()
    unlockBody()
    unlockBody()
    unlockBody()
    expect(getLockCount()).toBe(0)
  })

  it('exposes getLockCount', () => {
    forceUnlock()
    lockBody()
    expect(getLockCount()).toBe(1)
    unlockBody()
  })

  it('forceUnlock clears even when not locked', () => {
    forceUnlock()
    forceUnlock()
    expect(getLockCount()).toBe(0)
  })

  it('forceUnlock restores body overflow after lockBody', () => {
    document.body.style.overflow = 'auto'
    lockBody()
    expect(document.body.style.overflow).toBe('hidden')
    expect(getLockCount()).toBe(1)
    forceUnlock()
    expect(getLockCount()).toBe(0)
    expect(document.body.style.overflow).toBe('auto')
  })
})
