import { type ClassValue, clsx } from 'clsx'

let twMerge: ((input: string) => string) | undefined
let isTwMergeInitialized = false

export async function initTailwindMerge(): Promise<void> {
  if (isTwMergeInitialized) {
    return
  }

  try {
    const module = await import('tailwind-merge')
    twMerge = module?.twMerge || module?.default?.twMerge
  } catch {
    // tailwind-merge is not available, use fallback
    twMerge = undefined
  }

  isTwMergeInitialized = true
}

export function cn(...inputs: ClassValue[]) {
  if (!isTwMergeInitialized) {
    throw new Error(
      'initTailwindMerge() must be awaited before using cn(). Call await initTailwindMerge() during initialization.',
    )
  }

  const classes = clsx(inputs)
  return twMerge ? twMerge(classes) : classes
}

/**
 * Manages body overflow locking for nested dialogs and drawers.
 * Uses a counter to track how many modals are open, ensuring
 * overflow is only restored when all modals are closed.
 */

let lockCount = 0
let originalOverflow: string | null = null

/**
 * Lock body overflow. Increments the lock count.
 * Sets overflow to 'hidden' on first lock.
 */
export function lockBody(): void {
  lockCount++

  if (lockCount === 1) {
    // First lock - store original value and set to hidden
    originalOverflow = window.getComputedStyle(document.body).overflow
    document.body.style.overflow = 'hidden'
  }
}

/**
 * Unlock body overflow. Decrements the lock count.
 * Restores original overflow only when count reaches 0.
 */
export function unlockBody(): void {
  lockCount--

  if (lockCount < 0) {
    // Safety check - shouldn't happen, but reset if it does
    lockCount = 0
  }

  if (lockCount === 0 && originalOverflow !== null) {
    // Last unlock - restore original value
    document.body.style.overflow = originalOverflow
    originalOverflow = null
  }
}

/**
 * Get the current lock count (useful for debugging)
 */
export function getLockCount(): number {
  return lockCount
}

/**
 * Force unlock (emergency reset - use with caution)
 */
export function forceUnlock(): void {
  lockCount = 0
  if (originalOverflow !== null) {
    document.body.style.overflow = originalOverflow
    originalOverflow = null
  }
}
