// Track layout: a spacer of `viewport - offset` px sits above the sheet, so at
// `scrollTop = t` exactly `t + offset` px of the sheet are on screen. The
// offset is 0 when dismissible (`scrollTop` 0 = closed), or the lowest stop's
// height when not, so the sheet can't be scrolled below it. A marker `h` px
// below the sheet top with `scroll-margin-top` equal to the viewport snaps at
// `scrollTop = h - offset`.

export function nearestIndex(
  scrollTop: number,
  positions: readonly number[],
): number {
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  positions.forEach((pos, i) => {
    const distance = Math.abs(pos - scrollTop)
    if (distance < bestDistance) {
      best = i
      bestDistance = distance
    }
  })
  return best
}

/** Scroll range, in `scrollTop` px, over which the backdrop fades in. */
export type BackdropRange = {
  start: number
  end: number
  min: number
  max: number
}

/**
 * Fallback for browsers without scroll-driven animations: writes the backdrop's
 * opacity straight to it, so neither React nor the sheet's subtree restyles.
 * Opacity is `min` at or below `start`, `max` at or above `end`, and constant
 * `max` when the range is empty.
 */
export function writeBackdropOpacity(
  scroller: HTMLElement,
  backdrop: HTMLElement,
  { start, end, min, max }: BackdropRange,
): void {
  const progress =
    end > start
      ? Math.min(1, Math.max(0, (scroller.scrollTop - start) / (end - start)))
      : 1
  const from = Math.min(min, max)
  backdrop.style.opacity = (from + (max - from) * progress).toFixed(4)
}

export function supportsScrollTimeline(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('animation-timeline: scroll()') &&
    CSS.supports('timeline-scope: --a')
  )
}
