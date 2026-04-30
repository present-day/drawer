import { type ClassValue, clsx } from 'clsx'

let twMerge: ((input: string) => string) | undefined
let twMergeInitPromise: Promise<void> | undefined

/**
 * Eagerly resolve `tailwind-merge` (an optional peer dep) at module load time.
 * Safe to call many times — the import is shared. Once it resolves, `cn()`
 * calls dedupe Tailwind classes; until then they fall back to plain `clsx`.
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
  return twMergeInitPromise
}

// Kick off the import at module load time so tailwind-merge is ready before
// the first render. By the time a user can physically open the drawer, the
// async import (a few ms at most) will have resolved.
void ensureTwMergeInit()

/**
 * Opt-in: pre-warm tailwind-merge so the very first render can dedupe classes
 * synchronously. Optional — `cn()` works without it (the import kicks off
 * eagerly at module load; renders before it resolves use the clsx-only fallback).
 */
export async function initTailwindMerge(): Promise<void> {
  await ensureTwMergeInit()
}

export function cn(...inputs: ClassValue[]) {
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
