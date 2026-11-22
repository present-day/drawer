/**
 * Track layout: a spacer of `100dvh - stageOffset` sits above the sheet, so at
 * `scrollTop = t` exactly `t + stageOffset` px of the sheet's top edge are on
 * screen. `stageOffset` is 0 when dismissible (scrollTop 0 = closed), or the
 * smallest snap point when not, so the user cannot scroll below it.
 *
 * Returns `null` when there is nothing to offset to (non-dismissible with no
 * snap points): the sheet is then pinned fully open.
 */
export function stageOffset(
  snapPoints: readonly number[],
  dismissible: boolean,
): number | null {
  if (dismissible) return 0
  if (snapPoints.length === 0) return null
  return Math.min(...snapPoints)
}

export function spacerHeight(offset: number | null): string {
  if (offset === null) return '0px'
  return `calc(100dvh - ${offset}px)`
}

/**
 * A marker `p` px below the sheet top with `scroll-margin-top: 100dvh` snaps at
 * `spacer + p - 100dvh = p - offset`, leaving exactly `p` px of sheet visible
 * whatever the offset, so markers are always placed at `top: p`.
 */
export function snapScrollTop(visiblePx: number, offset: number): number {
  return Math.max(0, visiblePx - offset)
}

/**
 * Scroll positions of each snap, in `[...snapPoints, fullyOpen]` order.
 * `maxScrollTop` is the fully open position.
 */
export function snapPositions(
  snapPoints: readonly number[],
  offset: number,
  maxScrollTop: number,
): number[] {
  return [
    ...snapPoints.map((p) => Math.min(snapScrollTop(p, offset), maxScrollTop)),
    maxScrollTop,
  ]
}

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

/**
 * Fallback for browsers without scroll-driven animations: writes the backdrop's
 * opacity straight to it, so neither React nor the sheet's subtree restyles.
 * Opacity runs from `min` at `scrollTop` 0 to 1 fully open.
 */
export function writeBackdropOpacity(
  scroller: HTMLElement,
  backdrop: HTMLElement,
  min = 0,
): void {
  const max = scroller.scrollHeight - scroller.clientHeight
  const progress =
    max > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 1
  backdrop.style.opacity = (min + (1 - min) * progress).toFixed(4)
}

export function supportsScrollTimeline(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('animation-timeline: scroll()') &&
    CSS.supports('timeline-scope: --a')
  )
}
