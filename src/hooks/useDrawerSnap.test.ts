import { describe, expect, it } from 'vitest'

import { DRAWER_SIZING, VELOCITY_THRESHOLD } from '../constants'
import {
  heightToSnapRawValue,
  resolveSizingToHeights,
  resolveSnapAfterDrag,
  resolveSnapValueToPx,
} from './useDrawerSnap'

describe('resolveSnapValueToPx', () => {
  it('treats values in (0, 1] as fraction of available height', () => {
    expect(resolveSnapValueToPx(0.5, 800)).toBe(400)
    expect(resolveSnapValueToPx(1, 600)).toBe(600)
  })

  it('treats values > 1 as pixel heights', () => {
    expect(resolveSnapValueToPx(320, 800)).toBe(320)
  })
})

describe('resolveSizingToHeights', () => {
  it('FULL returns a single height capped to available space', () => {
    const { heights, rawValues } = resolveSizingToHeights(
      DRAWER_SIZING.FULL,
      700,
    )
    expect(heights).toEqual([700])
    expect(rawValues).toEqual([1])
  })

  it('AUTO falls back to a default when no measured height', () => {
    const { heights } = resolveSizingToHeights(DRAWER_SIZING.AUTO, 800, null)
    expect(heights.length).toBe(1)
    expect(heights[0]).toBeGreaterThan(0)
    expect(heights[0]).toBeLessThanOrEqual(800)
  })

  it('dedupes snap points and sorts ascending', () => {
    const { heights, rawValues } = resolveSizingToHeights(
      [0.25, 0.5, 0.25, 0.75],
      400,
    )
    expect(heights).toEqual([100, 200, 300])
    expect(rawValues).toEqual([0.25, 0.5, 0.75])
  })
})

describe('heightToSnapRawValue', () => {
  it('returns the raw value for an exact snap height', () => {
    const raw = heightToSnapRawValue(200, [0.25, 0.5], [100, 200], 400)
    expect(raw).toBe(0.5)
  })
})

describe('resolveSnapAfterDrag', () => {
  it('returns dismiss when below min with dismissible', () => {
    const result = resolveSnapAfterDrag({
      visibleHeight: 20,
      velocityY: 0,
      heightsAsc: [100, 200, 300],
      dismissible: true,
    })
    expect(result).toEqual({ type: 'dismiss' })
  })

  it('snaps to nearest index when not dismissing', () => {
    const result = resolveSnapAfterDrag({
      visibleHeight: 180,
      velocityY: 0,
      heightsAsc: [100, 200, 300],
      dismissible: false,
    })
    expect(result).toEqual({ type: 'snap', index: 1 })
  })

  it('returns dismiss when there are no snap heights', () => {
    expect(
      resolveSnapAfterDrag({
        visibleHeight: 200,
        velocityY: 0,
        heightsAsc: [],
        dismissible: true,
      }),
    ).toEqual({ type: 'dismiss' })
  })

  it('dismisses on high downward velocity when near the minimum snap (dismissible)', () => {
    const result = resolveSnapAfterDrag({
      visibleHeight: 100,
      velocityY: VELOCITY_THRESHOLD + 1,
      heightsAsc: [100, 200],
      dismissible: true,
    })
    expect(result).toEqual({ type: 'dismiss' })
  })

  it('snaps toward lower height when flinging down fast', () => {
    expect(
      resolveSnapAfterDrag({
        visibleHeight: 200,
        velocityY: VELOCITY_THRESHOLD + 1,
        heightsAsc: [100, 200, 300],
        dismissible: true,
      }),
    ).toEqual({ type: 'snap', index: 0 })
  })

  it('snaps toward higher height when flinging up fast', () => {
    expect(
      resolveSnapAfterDrag({
        visibleHeight: 200,
        velocityY: -VELOCITY_THRESHOLD - 1,
        heightsAsc: [100, 200, 300],
        dismissible: true,
      }),
    ).toEqual({ type: 'snap', index: 2 })
  })

  it('dismisses on low visible height with min as nearest snap and dismissible', () => {
    expect(
      resolveSnapAfterDrag({
        visibleHeight: 10,
        velocityY: 0,
        heightsAsc: [100, 200],
        dismissible: true,
      }),
    ).toEqual({ type: 'dismiss' })
  })

  it('clamps to last snap when not dismissible and above max', () => {
    expect(
      resolveSnapAfterDrag({
        visibleHeight: 9_000,
        velocityY: 0,
        heightsAsc: [100, 200, 300],
        dismissible: false,
      }),
    ).toEqual({ type: 'snap', index: 2 })
  })
})
