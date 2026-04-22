import { describe, expect, it } from 'vitest'

import { cn, forceUnlock, getLockCount, lockBody, unlockBody } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
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
