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
  DRAWER_SIZING,
  DRAWER_TOP_INSET_PX,
  VELOCITY_THRESHOLD,
} from '../constants'
import type { DrawerSizing, SnapPointValue } from '../types'

export function resolveSnapValueToPx(
  value: SnapPointValue,
  availableHeight: number,
): number {
  if (value <= 1) {
    return Math.max(0, Math.round(value * availableHeight))
  }
  return Math.max(0, Math.round(value))
}

export function resolveSizingToHeights(
  sizing: DrawerSizing,
  availableHeight: number,
  measuredAutoHeight?: number | null,
): { heights: number[]; rawValues: SnapPointValue[] } {
  const cap = Math.max(0, availableHeight)

  if (sizing === DRAWER_SIZING.FULL) {
    return { heights: [cap], rawValues: [1] }
  }

  if (sizing === DRAWER_SIZING.AUTO) {
    const h = Math.min(cap, Math.max(0, Math.round(measuredAutoHeight ?? 0)))
    return { heights: [h || Math.min(200, cap)], rawValues: [h] }
  }

  const pairs = sizing.map((raw) => ({
    raw,
    px: resolveSnapValueToPx(raw, cap),
  }))
  pairs.sort((a, b) => a.px - b.px)

  const heights: number[] = []
  const rawValues: SnapPointValue[] = []
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
  rawValues: SnapPointValue[],
  heights: number[],
  availableHeight: number,
): SnapPointValue {
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
 * Intrinsic height for {@link DRAWER_SIZING.AUTO}: sums each **direct** child’s
 * block size, using `scrollHeight` for `[data-drawer-scroll]` so the value
 * reflects full scrollable content instead of the flex-clamped layout height
 * (which `ResizeObserver`’s `contentRect` on the content root tracks). Put
 * `Drawer.Handle` and `Drawer.Scrollable` as direct children of
 * `Drawer.Content` (or an equivalent structure) for accurate AUTO sizing.
 */
export function measureIntrinsicAutoHeight(root: HTMLElement): number {
  let sum = 0
  let sawScrollRegion = false
  for (const child of root.children) {
    if (!(child instanceof HTMLElement)) continue
    if (child.hasAttribute('data-drawer-scroll')) {
      sawScrollRegion = true
      sum += child.scrollHeight
    } else {
      sum += child.offsetHeight
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

  const resubscribeScrollTargets = (ro: ResizeObserver) => {
    for (const node of root.querySelectorAll('[data-drawer-scroll]')) {
      if (node instanceof HTMLElement) {
        ro.observe(node)
        for (const ch of node.children) {
          if (ch instanceof HTMLElement) ro.observe(ch)
        }
      }
    }
  }

  const ro = new ResizeObserver(() => {
    schedule()
  })
  ro.observe(root)
  resubscribeScrollTargets(ro)

  let moRaf = 0
  const mo = new MutationObserver(() => {
    if (moRaf) return
    moRaf = requestAnimationFrame(() => {
      moRaf = 0
      resubscribeScrollTargets(ro)
      schedule()
    })
  })
  mo.observe(root, { childList: true, subtree: true })

  schedule()

  return () => {
    cancelAnimationFrame(raf)
    cancelAnimationFrame(moRaf)
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
 */
export function resolveSnapAfterDrag(args: {
  visibleHeight: number
  velocityY: number
  heightsAsc: number[]
  dismissible: boolean
}): { type: 'snap'; index: number } | { type: 'dismiss' } {
  const { visibleHeight, velocityY, heightsAsc, dismissible } = args
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
  sizing: DrawerSizing
  /** Raw visual viewport height (before top inset) */
  viewportHeight: number
  /** Subtracted from viewport height for snap math; default map inset. */
  topInsetPx?: number
  defaultSnapPoint?: SnapPointValue
  contentMeasureRef: RefObject<HTMLElement | null>
}

export function useDrawerSnap({
  sizing,
  viewportHeight,
  topInsetPx = DRAWER_TOP_INSET_PX,
  defaultSnapPoint,
  contentMeasureRef,
}: UseDrawerSnapArgs) {
  const availableHeight = Math.max(0, Math.round(viewportHeight - topInsetPx))

  const [measuredAutoHeight, setMeasuredAutoHeight] = useState<number | null>(
    null,
  )

  useEffect(() => {
    if (sizing !== DRAWER_SIZING.AUTO) return
    const el = contentMeasureRef.current
    if (!el) return

    return bindAutoMeasureObservers(el, (h) => {
      setMeasuredAutoHeight(h)
    })
  }, [contentMeasureRef, sizing])

  const { heights, rawValues } = useMemo(
    () => resolveSizingToHeights(sizing, availableHeight, measuredAutoHeight),
    [sizing, availableHeight, measuredAutoHeight],
  )

  const defaultIndex = useMemo(() => {
    if (heights.length === 0) return 0
    if (defaultSnapPoint === undefined) return heights.length - 1
    const target = resolveSnapValueToPx(defaultSnapPoint, availableHeight)
    return nearestHeightIndex(target, heights)
  }, [heights, defaultSnapPoint, availableHeight])

  return {
    availableHeight,
    snapHeights: heights,
    rawSnapValues: rawValues,
    defaultIndex,
    resolveSnapToIndex: useCallback(
      (point: SnapPointValue) => {
        const target = resolveSnapValueToPx(point, availableHeight)
        return nearestHeightIndex(target, heights)
      },
      [availableHeight, heights],
    ),
    indexToRawValue: useCallback(
      (index: number): SnapPointValue | null => {
        const h = heights[index]
        if (h === undefined) return null
        return heightToSnapRawValue(h, rawValues, heights, availableHeight)
      },
      [availableHeight, heights, rawValues],
    ),
  }
}
