import { type ClassValue, clsx } from 'clsx'

let twMerge: ((input: string) => string) | undefined
let isTwMergeInitialized = false
let twMergeInitPromise: Promise<void> | undefined

/**
 * Lazily resolve `tailwind-merge` (an optional peer dep). Safe to call many
 * times — the import is shared. Once it resolves, future `cn()` calls dedupe
 * Tailwind classes; until then they fall back to plain `clsx`.
 */
function ensureTwMergeInit(): Promise<void> {
  if (twMergeInitPromise) return twMergeInitPromise
  twMergeInitPromise = import('tailwind-merge')
    .then((module) => {
      twMerge = module?.twMerge ?? module?.default?.twMerge
    })
    .catch(() => {
      // tailwind-merge is not installed — keep `twMerge` undefined and use
      // the clsx-only fallback in `cn`.
      twMerge = undefined
    })
    .finally(() => {
      isTwMergeInitialized = true
    })
  return twMergeInitPromise
}

/**
 * Opt-in: pre-warm tailwind-merge so the very first render can dedupe classes
 * synchronously. Optional — `cn()` works without it (the import kicks off
 * lazily on first use; renders before it resolves use the clsx-only fallback).
 */
export async function initTailwindMerge(): Promise<void> {
  await ensureTwMergeInit()
}

export function cn(...inputs: ClassValue[]) {
  // Kick off the dynamic import on first use; do not block rendering on it.
  // Subsequent renders pick up `twMerge` once the promise has resolved.
  if (!isTwMergeInitialized) {
    void ensureTwMergeInit()
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
