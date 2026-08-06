import { describe, expect, it } from 'vitest'

import { SNAP_POINT } from '../constants'
import {
  resolveSnapPointsToHeights,
  resolveSnapValueToPx,
} from './useDrawerSnap'

/**
 * `'screen'` exists because `'full'`/`MAX` mean "full AVAILABLE height" —
 * viewport minus `topInsetPx` (96px by default). That is right for a sheet
 * floating over content and wrong when the drawer IS the task: a long list, or
 * a field with the software keyboard up.
 *
 * `topInsetPx={0}` already achieved this, but only for the whole drawer. These
 * assertions pin the thing that prop cannot express — resting inset while
 * still having a stop that reaches the top.
 */
const VIEWPORT = 800
const TOP_INSET = 96
const AVAILABLE = VIEWPORT - TOP_INSET // 704

describe('SNAP_POINT.SCREEN', () => {
  it('is exported as a usable token', () => {
    expect(SNAP_POINT.SCREEN).toBe('screen')
  })

  it('resolves to the ENTIRE viewport, not the available height', () => {
    expect(resolveSnapValueToPx('screen', AVAILABLE, null, 0, VIEWPORT)).toBe(
      VIEWPORT,
    )
  })

  it("is taller than 'full' by exactly the top inset", () => {
    const full = resolveSnapValueToPx('full', AVAILABLE)
    const screen = resolveSnapValueToPx('screen', AVAILABLE, null, 0, VIEWPORT)
    expect(screen - full).toBe(TOP_INSET)
  })

  it('degrades to full rather than 0 when no viewport is supplied', () => {
    // Guards the optional-parameter design: an internal caller that forgets to
    // thread the viewport should lose the extra inset, not collapse the drawer.
    expect(resolveSnapValueToPx('screen', AVAILABLE)).toBe(AVAILABLE)
  })

  it('coexists with auto — rest at content height, expand to the top', () => {
    const { heights, rawValues } = resolveSnapPointsToHeights(
      ['auto', 'screen'],
      AVAILABLE,
      300, // measured content
      0,
      VIEWPORT,
    )
    expect(heights).toEqual([300, VIEWPORT])
    expect(rawValues).toEqual(['auto', 'screen'])
  })

  it('still caps auto at the available height, so content-fit respects the inset', () => {
    const { heights } = resolveSnapPointsToHeights(
      ['auto', 'screen'],
      AVAILABLE,
      5000, // content taller than the screen
      0,
      VIEWPORT,
    )
    // 'auto' clamps to AVAILABLE; only the explicit 'screen' stop reaches the top.
    expect(heights).toEqual([AVAILABLE, VIEWPORT])
  })

  it('sorts above every fractional stop', () => {
    const { heights } = resolveSnapPointsToHeights(
      [SNAP_POINT.HALF, SNAP_POINT.SCREEN, SNAP_POINT.FULL],
      AVAILABLE,
      null,
      0,
      VIEWPORT,
    )
    expect(heights[heights.length - 1]).toBe(VIEWPORT)
    expect(heights).toEqual([352, AVAILABLE, VIEWPORT])
  })
})
