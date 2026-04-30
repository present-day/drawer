'use client'

import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  DISMISS_THRESHOLD_PX,
  DRAWER_TOP_INSET_PX,
  VELOCITY_THRESHOLD,
} from '../constants'
import type { SnapPoint } from '../types'

/** Used only when we have not received a real measurement yet (0 / null). */
const AUTO_FALLBACK_HEIGHT_PX = 0

export function resolveSnapValueToPx(
  value: SnapPoint,
  availableHeight: number,
  measuredAutoHeight?: number | null,
): number {
  // String tokens describe height policies, not literal numbers:
  //   - 'auto' uses the live measured content height (capped at the viewport)
  //   - 'full' uses the full available drawer height
  if (value === 'auto') {
    return Math.min(
      Math.max(0, availableHeight),
      Math.max(0, Math.round(measuredAutoHeight ?? 0)),
    )
  }
  if (value === 'full') {
    return Math.max(0, availableHeight)
  }
  if (value <= 1) {
    return Math.max(0, Math.round(value * availableHeight))
  }
  return Math.max(0, Math.round(value))
}

/**
 * Resolve a `snapPoints` array to ascending pixel heights and the raw values
 * that produced them. The `'auto'` slot grows or shrinks with `measuredAutoHeight`;
 * the `'full'` slot always equals the full available drawer height. Duplicate
 * resolved heights are removed (first occurrence wins after sorting).
 */
export function resolveSnapPointsToHeights(
  snapPoints: readonly SnapPoint[],
  availableHeight: number,
  measuredAutoHeight?: number | null,
): { heights: number[]; rawValues: SnapPoint[] } {
  const cap = Math.max(0, availableHeight)

  // Empty array: caller passed `snapPoints={[]}` (rare but legal). Keep the
  // hook output empty so the Drawer renders nothing snappable.
  if (snapPoints.length === 0) {
    return { heights: [], rawValues: [] }
  }

  // Single 'auto' fast-path: this is the default sizing case. We don't take
  // the generic path here because we want a 0 fallback height while the
  // measurement is still pending — the generic path's dedupe-after-sort
  // would still produce the same result, but this keeps the hot default
  // free of array allocation/sort overhead.
  //
  // NOTE: rawValues preserves the original `'auto'` token (not the resolved
  // pixel height). Downstream consumers — `getActiveSnapPoint()` and
  // `useDrawerKeyboardSnapMobile` (saves the active snap before the keyboard
  // opens, restores after it closes) — rely on the raw being `'auto'` so
  // the slot continues to track measured content after restore. Returning
  // the resolved pixel height here would freeze the stop at whatever size
  // the content was at save time.
  if (snapPoints.length === 1 && snapPoints[0] === 'auto') {
    const measured = Math.min(
      cap,
      Math.max(0, Math.round(measuredAutoHeight ?? 0)),
    )
    const fallback = Math.min(AUTO_FALLBACK_HEIGHT_PX, cap)
    // Trust any positive measure (including very short UIs). The old
    // "minimum shelf" used when measured < 120px caused short content to
    // jump to 200px. `measured === 0` means layout has not reported size yet.
    const resolvedHeight = measured > 0 ? measured : fallback
    return { heights: [resolvedHeight], rawValues: ['auto'] }
  }

  const pairs = snapPoints.map((raw) => ({
    raw,
    px: resolveSnapValueToPx(raw, cap, measuredAutoHeight),
  }))
  pairs.sort((a, b) => a.px - b.px)

  const heights: number[] = []
  const rawValues: SnapPoint[] = []
  for (const p of pairs) {
    if (!heights.includes(p.px)) {
      heights.push(p.px)
      rawValues.push(p.raw)
    }
  }

  return { heights, rawValues }
}

export function heightToSnapRawValue(
  heightPx: number,
  rawValues: SnapPoint[],
  heights: number[],
  availableHeight: number,
): SnapPoint {
  const idx = heights.indexOf(heightPx)
  const rawAtHeight = rawValues[idx]
  if (idx >= 0 && rawAtHeight !== undefined) {
    return rawAtHeight
  }
  const nearest = nearestHeightIndex(heightPx, heights)
  const raw = rawValues[nearest]
  if (raw !== undefined) return raw
  const h = heights[nearest]
  if (h === undefined) return 0.5
  return availableHeight > 0 ? h / availableHeight : 0.5
}

/**
 * Max `scrollHeight - clientHeight` for an element and its descendants. Picks up
 * clipped scroll regions whose extra height does not change the content root’s
 * `contentRect` (common with `overflow: auto` on a child that is not
 * `[data-drawer-scroll]`).
 */
export function maxDescendantScrollOverflow(el: HTMLElement): number {
  let max = 0
  const stack: HTMLElement[] = [el]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    max = Math.max(max, node.scrollHeight - node.clientHeight)
    for (const ch of node.children) {
      if (ch instanceof HTMLElement) stack.push(ch)
    }
  }
  return Math.max(0, max)
}

/**
 * Intrinsic height for the `'auto'` snap point: sums each **direct** child’s
 * layout block size, using `scrollHeight` for `[data-drawer-scroll]` so the
 * value reflects full scrollable content instead of the flex-clamped layout
 * height (which `ResizeObserver`’s `contentRect` on the content root tracks).
 * Other direct children add **layout height plus** the max descendant
 * `(scrollHeight − clientHeight)` under that child so unmarked scroll areas
 * still expand AUTO. For non-scroll children, when `offsetHeight` collapses to
 * 0 (a flex child while the panel height is still animating short), fall back
 * to `scrollHeight` so AUTO does not under-measure. We deliberately do NOT use
 * `getBoundingClientRect().height` as a floor: for stretchy children that
 * fill the panel, that value tracks the panel height and creates a feedback
 * loop where the measured height grows in lockstep with the animating panel —
 * the user-visible symptom is the drawer sliding upward pixel-by-pixel.
 * Prefer `Drawer.Handle` and `Drawer.Scrollable` as direct children of
 * `Drawer.Content` when possible.
 */
export function measureIntrinsicAutoHeight(root: HTMLElement): number {
  let sum = 0
  let sawScrollRegion = false
  for (const child of root.children) {
    if (!(child instanceof HTMLElement)) continue
    if (child.hasAttribute('data-drawer-scroll')) {
      sawScrollRegion = true
      // When content overflows the scroll container, `scrollHeight` reports
      // the natural overflow content size — exactly what AUTO wants in order
      // to expand the drawer to fit. When content fits, however, `scrollHeight`
      // equals `clientHeight`, which tracks the (possibly animating) container
      // height. Using it directly there feeds the panel's height back into
      // the measurement and produces a slow upward drift. In the no-overflow
      // case sum the direct children's own offsetHeights so the measurement
      // reflects intrinsic content rather than the stretched container.
      const scrollOverflow = child.scrollHeight - child.clientHeight
      if (scrollOverflow > 0) {
        sum += child.scrollHeight
      } else {
        let inner = 0
        for (const grand of child.children) {
          if (grand instanceof HTMLElement) inner += grand.offsetHeight
        }
        sum += inner
      }
    } else {
      const withDescendantOverflow =
        child.offsetHeight + maxDescendantScrollOverflow(child)
      // Only use scrollHeight as a fallback when the layout collapsed the
      // child to 0 (flex item during the intro animation). Otherwise trust
      // `offsetHeight` so we don't inflate AUTO to the panel height for
      // children that currently stretch to fill it.
      const contribution =
        withDescendantOverflow === 0
          ? child.scrollHeight
          : withDescendantOverflow
      sum += contribution
    }
  }
  if (sawScrollRegion || sum > 0) {
    return Math.ceil(Math.max(0, sum))
  }
  // No scroll region / no direct children: overflow or text directly on the root
  return Math.ceil(Math.max(0, root.scrollHeight, root.offsetHeight))
}

function bindAutoMeasureObservers(
  root: HTMLElement,
  onMeasure: (height: number) => void,
): () => void {
  let raf = 0

  const runMeasure = () => {
    onMeasure(measureIntrinsicAutoHeight(root))
  }

  const schedule = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      raf = 0
      runMeasure()
    })
  }

  const observed = new WeakSet<HTMLElement>()
  const observeIfNeeded = (el: HTMLElement, ro: ResizeObserver) => {
    if (observed.has(el)) return
    observed.add(el)
    ro.observe(el)
  }

  const resubscribeTargets = (ro: ResizeObserver) => {
    observeIfNeeded(root, ro)
    for (const node of root.querySelectorAll('*')) {
      if (node instanceof HTMLElement) {
        observeIfNeeded(node, ro)
      }
    }
  }

  const ro = new ResizeObserver(() => {
    schedule()
  })
  resubscribeTargets(ro)

  let moRaf = 0
  const mo = new MutationObserver(() => {
    if (moRaf) return
    moRaf = requestAnimationFrame(() => {
      moRaf = 0
      resubscribeTargets(ro)
      schedule()
    })
  })
  mo.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-state'],
  })

  root.addEventListener('load', schedule, true)
  schedule()

  return () => {
    cancelAnimationFrame(raf)
    cancelAnimationFrame(moRaf)
    root.removeEventListener('load', schedule, true)
    ro.disconnect()
    mo.disconnect()
  }
}

function nearestHeightIndex(
  visibleHeight: number,
  heightsAsc: number[],
): number {
  if (heightsAsc.length === 0) return 0
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < heightsAsc.length; i++) {
    const h = heightsAsc[i]
    if (h === undefined) continue
    const d = Math.abs(h - visibleHeight)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/**
 * Pick snap index after drag end using velocity-weighted rules.
 *
 * When `snapToSequentialPoint` is true, fast swipes only advance one snap stop
 * at a time rather than flying past intermediate stops. Slow drag (nearest-stop)
 * is unaffected.
 */
export function resolveSnapAfterDrag(args: {
  visibleHeight: number
  velocityY: number
  heightsAsc: number[]
  dismissible: boolean
  /** Current snap index — required when `snapToSequentialPoint` is true. */
  currentSnapIndex?: number
  /** When true, velocity-based skipping is limited to one adjacent stop. */
  snapToSequentialPoint?: boolean
}): { type: 'snap'; index: number } | { type: 'dismiss' } {
  const {
    visibleHeight,
    velocityY,
    heightsAsc,
    dismissible,
    currentSnapIndex,
    snapToSequentialPoint,
  } = args
  if (heightsAsc.length === 0) {
    return { type: 'dismiss' }
  }

  const first = heightsAsc[0]
  const last = heightsAsc[heightsAsc.length - 1]
  if (first === undefined || last === undefined) {
    return { type: 'dismiss' }
  }
  const minH = first
  const maxH = last

  if (dismissible) {
    if (visibleHeight < minH - DISMISS_THRESHOLD_PX) {
      return { type: 'dismiss' }
    }
    if (velocityY > VELOCITY_THRESHOLD && visibleHeight <= minH + 40) {
      return { type: 'dismiss' }
    }
  }

  if (velocityY > VELOCITY_THRESHOLD) {
    // Fast downward swipe.
    if (snapToSequentialPoint && currentSnapIndex !== undefined) {
      // Sequential mode: only go to the previous adjacent stop.
      const prevIdx = currentSnapIndex - 1
      if (prevIdx < 0) {
        return dismissible ? { type: 'dismiss' } : { type: 'snap', index: 0 }
      }
      return { type: 'snap', index: prevIdx }
    }
    const below = heightsAsc.filter((h) => h < visibleHeight - 16)
    if (below.length > 0) {
      const li = below.length - 1
      const targetBelow = below[li]
      if (targetBelow !== undefined) {
        return { type: 'snap', index: heightsAsc.indexOf(targetBelow) }
      }
    }
    if (dismissible && visibleHeight < minH + DISMISS_THRESHOLD_PX / 2) {
      return { type: 'dismiss' }
    }
  }

  if (velocityY < -VELOCITY_THRESHOLD) {
    // Fast upward swipe.
    if (snapToSequentialPoint && currentSnapIndex !== undefined) {
      // Sequential mode: only go to the next adjacent stop.
      const nextIdx = Math.min(currentSnapIndex + 1, heightsAsc.length - 1)
      return { type: 'snap', index: nextIdx }
    }
    const above = heightsAsc.filter((h) => h > visibleHeight + 16)
    const targetAbove = above[0]
    if (targetAbove !== undefined) {
      return { type: 'snap', index: heightsAsc.indexOf(targetAbove) }
    }
  }

  const idx = nearestHeightIndex(visibleHeight, heightsAsc)
  const targetH = heightsAsc[idx]
  /* istanbul ignore next 3 -- defensive: `idx` is always in range for a non-empty array */
  if (targetH === undefined) {
    return { type: 'snap', index: idx }
  }

  if (
    dismissible &&
    targetH === minH &&
    visibleHeight < minH - DISMISS_THRESHOLD_PX / 2
  ) {
    return { type: 'dismiss' }
  }

  if (!dismissible && visibleHeight > maxH) {
    return { type: 'snap', index: heightsAsc.length - 1 }
  }

  return { type: 'snap', index: idx }
}

export type UseDrawerSnapArgs = {
  snapPoints: readonly SnapPoint[]
  /** Raw visual viewport height (before top inset) */
  viewportHeight: number
  /** Subtracted from viewport height for snap math; default map inset. */
  topInsetPx?: number
  defaultSnapPoint?: SnapPoint
  contentMeasureRef: RefObject<HTMLElement | null>
  /**
   * Bumped by the Drawer whenever the measure element attaches/detaches.
   * Required because a mutation to `contentMeasureRef.current` is invisible
   * to React effect deps; without it the ResizeObserver is never re-bound
   * after the drawer first opens (`open` flips false → true), so AUTO sizing
   * would stay stuck on the fallback height.
   */
  measureAttachGeneration?: number
}

export function useDrawerSnap({
  snapPoints,
  viewportHeight,
  topInsetPx = DRAWER_TOP_INSET_PX,
  defaultSnapPoint,
  contentMeasureRef,
  measureAttachGeneration = 0,
}: UseDrawerSnapArgs) {
  const availableHeight = Math.max(0, Math.round(viewportHeight - topInsetPx))

  const [measuredAutoHeight, setMeasuredAutoHeight] = useState<number | null>(
    null,
  )

  // Measurement is needed any time `'auto'` appears in the snap array. Other
  // tokens (`'full'`) and numeric stops are derivable from `availableHeight`
  // alone.
  const needsAutoMeasurement = snapPoints.includes('auto')

  useEffect(() => {
    if (!needsAutoMeasurement) return
    const el = contentMeasureRef.current
    if (!el) {
      setMeasuredAutoHeight(null)
      return
    }

    return bindAutoMeasureObservers(el, (h) => {
      // Hysteresis: ignore sub-pixel jitter (≤1px) so transient layout noise
      // during the open animation doesn't churn `snapHeights` and re-target
      // the resnap spring every frame.
      setMeasuredAutoHeight((prev) => {
        if (prev !== null && Math.abs(prev - h) <= 1) return prev
        return h
      })
    })
  }, [contentMeasureRef, needsAutoMeasurement, measureAttachGeneration])

  const { heights, rawValues } = useMemo(
    () =>
      resolveSnapPointsToHeights(
        snapPoints,
        availableHeight,
        measuredAutoHeight,
      ),
    [snapPoints, availableHeight, measuredAutoHeight],
  )

  const defaultIndex = useMemo(() => {
    if (heights.length === 0) return 0
    if (defaultSnapPoint === undefined) return heights.length - 1
    const target = resolveSnapValueToPx(
      defaultSnapPoint,
      availableHeight,
      measuredAutoHeight,
    )
    return nearestHeightIndex(target, heights)
  }, [heights, defaultSnapPoint, availableHeight, measuredAutoHeight])

  return {
    availableHeight,
    snapHeights: heights,
    rawSnapValues: rawValues,
    defaultIndex,
    resolveSnapToIndex: useCallback(
      (point: SnapPoint) => {
        const target = resolveSnapValueToPx(
          point,
          availableHeight,
          measuredAutoHeight,
        )
        return nearestHeightIndex(target, heights)
      },
      [availableHeight, heights, measuredAutoHeight],
    ),
    indexToRawValue: useCallback(
      (index: number): SnapPoint | null => {
        const h = heights[index]
        if (h === undefined) return null
        return heightToSnapRawValue(h, rawValues, heights, availableHeight)
      },
      [availableHeight, heights, rawValues],
    ),
  }
}
