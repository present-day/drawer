'use client'

import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  DRAWER_SIZING,
  DRAWER_TOP_INSET_PX,
  DISMISS_THRESHOLD_PX,
  VELOCITY_THRESHOLD,
} from '../constants'
import type {
  DrawerSizing,
  SnapPointValue,
} from '../types'

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
    const h = Math.min(
      cap,
      Math.max(0, Math.round(measuredAutoHeight ?? 0)),
    )
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
  if (idx >= 0 && rawValues[idx] !== undefined) {
    return rawValues[idx]!
  }
  const nearest = nearestHeightIndex(heightPx, heights)
  const raw = rawValues[nearest]
  if (raw !== undefined) return raw
  const h = heights[nearest]
  if (h === undefined) return 0.5
  return availableHeight > 0 ? h / availableHeight : 0.5
}

function nearestHeightIndex(visibleHeight: number, heightsAsc: number[]): number {
  if (heightsAsc.length === 0) return 0
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < heightsAsc.length; i++) {
    const h = heightsAsc[i]!
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

  const minH = heightsAsc[0]!
  const maxH = heightsAsc[heightsAsc.length - 1]!

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
      const target = below[below.length - 1]!
      return { type: 'snap', index: heightsAsc.indexOf(target) }
    }
    if (dismissible && visibleHeight < minH + DISMISS_THRESHOLD_PX / 2) {
      return { type: 'dismiss' }
    }
  }

  if (velocityY < -VELOCITY_THRESHOLD) {
    const above = heightsAsc.filter((h) => h > visibleHeight + 16)
    if (above.length > 0) {
      const target = above[0]!
      return { type: 'snap', index: heightsAsc.indexOf(target) }
    }
  }

  const idx = nearestHeightIndex(visibleHeight, heightsAsc)
  const targetH = heightsAsc[idx]!

  if (dismissible && targetH === minH && visibleHeight < minH - DISMISS_THRESHOLD_PX / 2) {
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

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const h = entry.contentRect.height
      setMeasuredAutoHeight(Math.ceil(h))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [contentMeasureRef, sizing])

  const { heights, rawValues } = useMemo(
    () =>
      resolveSizingToHeights(sizing, availableHeight, measuredAutoHeight),
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

// Backward compatibility
export type UseBottomSheetSnapArgs = UseDrawerSnapArgs
export const useBottomSheetSnap = useDrawerSnap