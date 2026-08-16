/**
 * `bottomInsetPx` reserves space at the bottom of the viewport for chrome the
 * sheet must sit above — a fixed nav bar, a tab bar — rather than cover.
 *
 * It is the mirror of `topInsetPx`, and it has to reach the snap math, not
 * just the panel's `bottom`. If only the position moved, every fractional
 * stop would be too tall by the inset and `'full'` would resolve to a height
 * that runs underneath the very chrome the inset exists to clear.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  resolveSnapPointsToHeights,
  resolveSnapValueToPx,
  useDrawerSnap,
} from './useDrawerSnap'

const VIEWPORT = 900
const TOP = 96
const BOTTOM = 64

/** What the hook computes and hands to the resolvers. */
const available = (top = TOP, bottom = 0) => VIEWPORT - top - bottom

describe('bottom inset in snap resolution', () => {
  it('shrinks the height a fraction resolves to', () => {
    const without = resolveSnapValueToPx(0.5, available(TOP, 0))
    const withInset = resolveSnapValueToPx(0.5, available(TOP, BOTTOM))

    expect(without).toBe(Math.round(0.5 * (VIEWPORT - TOP)))
    expect(withInset).toBe(Math.round(0.5 * (VIEWPORT - TOP - BOTTOM)))
    expect(withInset).toBeLessThan(without)
  })

  /**
   * The stop that would otherwise run under the nav bar. `'full'` means "all
   * the room this sheet is allowed", and the inset is part of that allowance.
   */
  it("keeps 'full' clear of the reserved space", () => {
    expect(resolveSnapValueToPx('full', available(TOP, BOTTOM))).toBe(
      VIEWPORT - TOP - BOTTOM,
    )
  })

  /**
   * `'screen'` means the whole viewport — it already ignores `topInsetPx`, and
   * it ignores this for the same reason: a sheet asking to BE the screen is
   * not asking to politely clear the tab bar.
   */
  it("leaves 'screen' at the full viewport", () => {
    expect(
      resolveSnapValueToPx('screen', available(TOP, BOTTOM), null, 0, VIEWPORT),
    ).toBe(VIEWPORT)
  })

  // A fixed pixel stop is a literal request; the inset moves where it sits,
  // not how tall it is.
  it('leaves absolute pixel stops alone', () => {
    expect(resolveSnapValueToPx(80, available(TOP, BOTTOM))).toBe(80)
  })

  it("caps 'auto' at the reduced available height", () => {
    const tallContent = 10_000
    expect(
      resolveSnapValueToPx('auto', available(TOP, BOTTOM), tallContent),
    ).toBe(VIEWPORT - TOP - BOTTOM)
  })

  it('shrinks a whole snap ladder consistently', () => {
    const { heights } = resolveSnapPointsToHeights(
      [80, 0.5, 'full'],
      available(TOP, BOTTOM),
    )
    expect(heights).toEqual([
      80,
      Math.round(0.5 * (VIEWPORT - TOP - BOTTOM)),
      VIEWPORT - TOP - BOTTOM,
    ])
    // Still ascending, still inside the allowance.
    expect(heights[heights.length - 1]).toBeLessThanOrEqual(
      VIEWPORT - TOP - BOTTOM,
    )
  })
})

/**
 * The resolver tests above take an already-reduced `availableHeight`, so they
 * only cover arithmetic that `bottomInsetPx` never touched — they pass with or
 * without the hook subtracting it. These drive the hook itself, which is where
 * the subtraction actually has to happen.
 */
describe('useDrawerSnap wiring', () => {
  const render = (bottomInsetPx?: number) =>
    renderHook(() =>
      useDrawerSnap({
        snapPoints: [0.5, 'full'],
        viewportHeight: VIEWPORT,
        topInsetPx: TOP,
        bottomInsetPx,
        contentMeasureRef: { current: null },
      }),
    ).result.current.snapHeights

  it('subtracts the bottom inset from the heights it resolves', () => {
    expect(render(BOTTOM)).toEqual([
      Math.round(0.5 * (VIEWPORT - TOP - BOTTOM)),
      VIEWPORT - TOP - BOTTOM,
    ])
  })

  it('is a no-op when omitted, so existing drawers are untouched', () => {
    expect(render()).toEqual([
      Math.round(0.5 * (VIEWPORT - TOP)),
      VIEWPORT - TOP,
    ])
  })

  it('never resolves a stop that would run under the reserved space', () => {
    const tallest = Math.max(...render(BOTTOM))
    expect(tallest).toBeLessThanOrEqual(VIEWPORT - TOP - BOTTOM)
  })
})
