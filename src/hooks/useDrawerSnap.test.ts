import { describe, expect, it } from 'vitest'

import { VELOCITY_THRESHOLD } from '../constants'
import {
  heightToSnapRawValue,
  maxDescendantScrollOverflow,
  measureIntrinsicAutoHeight,
  resolveSnapAfterDrag,
  resolveSnapPointsToHeights,
  resolveSnapValueToPx,
} from './useDrawerSnap'

describe('measureIntrinsicAutoHeight', () => {
  it('sums handle offsetHeights and scroll region scrollHeight (not layout height)', () => {
    const root = document.createElement('div')
    const handle = document.createElement('div')
    Object.defineProperty(handle, 'offsetHeight', {
      configurable: true,
      value: 40,
    })
    const scroll = document.createElement('div')
    scroll.setAttribute('data-drawer-scroll', '')
    Object.defineProperty(scroll, 'offsetHeight', {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(scroll, 'scrollHeight', {
      configurable: true,
      value: 900,
    })
    root.append(handle, scroll)
    expect(measureIntrinsicAutoHeight(root)).toBe(940)
  })

  it('falls back to root scrollHeight when there is no scroll region', () => {
    const root = document.createElement('div')
    Object.defineProperty(root, 'offsetHeight', {
      configurable: true,
      value: 0,
    })
    Object.defineProperty(root, 'scrollHeight', {
      configurable: true,
      value: 120,
    })
    expect(measureIntrinsicAutoHeight(root)).toBe(120)
  })

  it('adds descendant scroll overflow for direct children without data-drawer-scroll', () => {
    const root = document.createElement('div')
    const wrapper = document.createElement('div')
    Object.defineProperty(wrapper, 'offsetHeight', {
      configurable: true,
      value: 200,
    })
    const innerScroll = document.createElement('div')
    Object.defineProperty(innerScroll, 'clientHeight', {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(innerScroll, 'scrollHeight', {
      configurable: true,
      value: 800,
    })
    wrapper.append(innerScroll)
    root.append(wrapper)
    expect(measureIntrinsicAutoHeight(root)).toBe(800)
  })

  it('uses scrollHeight when a direct child has 0 offsetHeight (flex-squashed)', () => {
    const root = document.createElement('div')
    const child = document.createElement('div')
    Object.defineProperty(child, 'offsetHeight', {
      configurable: true,
      value: 0,
    })
    Object.defineProperty(child, 'scrollHeight', {
      configurable: true,
      value: 72,
    })
    Object.defineProperty(child, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        height: 0,
        width: 0,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        toJSON: () => ({}),
      }),
    })
    root.appendChild(child)
    expect(measureIntrinsicAutoHeight(root)).toBe(72)
  })
})

describe('maxDescendantScrollOverflow', () => {
  it('returns the largest scrollHeight minus clientHeight in the subtree', () => {
    const root = document.createElement('div')
    Object.defineProperty(root, 'clientHeight', {
      configurable: true,
      value: 100,
    })
    Object.defineProperty(root, 'scrollHeight', {
      configurable: true,
      value: 100,
    })
    const a = document.createElement('div')
    Object.defineProperty(a, 'clientHeight', { configurable: true, value: 50 })
    Object.defineProperty(a, 'scrollHeight', { configurable: true, value: 350 })
    const b = document.createElement('div')
    Object.defineProperty(b, 'clientHeight', { configurable: true, value: 40 })
    Object.defineProperty(b, 'scrollHeight', { configurable: true, value: 90 })
    root.append(a, b)
    expect(maxDescendantScrollOverflow(root)).toBe(300)
  })
})

describe('resolveSnapValueToPx', () => {
  it('treats values in (0, 1] as fraction of available height', () => {
    expect(resolveSnapValueToPx(0.5, 800)).toBe(400)
    expect(resolveSnapValueToPx(1, 600)).toBe(600)
  })

  it('treats values > 1 as pixel heights', () => {
    expect(resolveSnapValueToPx(320, 800)).toBe(320)
  })

  it("'full' resolves to the full available height", () => {
    expect(resolveSnapValueToPx('full', 800)).toBe(800)
  })

  it("'auto' resolves to measured content height (capped at viewport)", () => {
    expect(resolveSnapValueToPx('auto', 800, 320)).toBe(320)
    expect(resolveSnapValueToPx('auto', 400, 900)).toBe(400)
  })

  it("'auto' resolves to 0 when no measurement is available yet", () => {
    expect(resolveSnapValueToPx('auto', 800, null)).toBe(0)
    expect(resolveSnapValueToPx('auto', 800)).toBe(0)
  })
})

describe('resolveSnapPointsToHeights', () => {
  it('returns empty arrays when given an empty snap array', () => {
    const { heights, rawValues } = resolveSnapPointsToHeights([], 700)
    expect(heights).toEqual([])
    expect(rawValues).toEqual([])
  })

  it("['full'] returns a single height capped to available space", () => {
    const { heights, rawValues } = resolveSnapPointsToHeights(['full'], 700)
    expect(heights).toEqual([700])
    expect(rawValues).toEqual(['full'])
  })

  it("['auto'] uses zero fallback when no measured height yet", () => {
    const { heights } = resolveSnapPointsToHeights(['auto'], 800, null)
    expect(heights.length).toBe(1)
    expect(heights[0]).toBe(0)
    expect(heights[0]).toBeLessThanOrEqual(800)
  })

  it("['auto'] uses a small positive measured height (no 200px minimum shelf)", () => {
    const { heights, rawValues } = resolveSnapPointsToHeights(['auto'], 800, 48)
    expect(heights).toEqual([48])
    // raw stays as 'auto' so the slot keeps tracking the live measurement
    // after restores (e.g. via useDrawerKeyboardSnapMobile).
    expect(rawValues).toEqual(['auto'])
  })

  it("['auto'] uses measured height when content is substantial", () => {
    const { heights, rawValues } = resolveSnapPointsToHeights(
      ['auto'],
      800,
      360,
    )
    expect(heights).toEqual([360])
    expect(rawValues).toEqual(['auto'])
  })

  it('dedupes snap points and sorts ascending', () => {
    const { heights, rawValues } = resolveSnapPointsToHeights(
      [0.25, 0.5, 0.25, 0.75],
      400,
    )
    expect(heights).toEqual([100, 200, 300])
    expect(rawValues).toEqual([0.25, 0.5, 0.75])
  })

  it("array with 'auto' substitutes the measured content height", () => {
    const { heights, rawValues } = resolveSnapPointsToHeights(
      ['auto', 480, 0.92],
      1000,
      280,
    )
    // 'auto' -> 280, 480 -> 480, 0.92 -> 920; sorted ascending
    expect(heights).toEqual([280, 480, 920])
    expect(rawValues).toEqual(['auto', 480, 0.92])
  })

  it("array with 'full' resolves to the full available height", () => {
    const { heights, rawValues } = resolveSnapPointsToHeights(
      ['full', 200],
      800,
    )
    expect(heights).toEqual([200, 800])
    expect(rawValues).toEqual([200, 'full'])
  })

  it("'auto' inside an array updates as measured height changes", () => {
    const { heights: a } = resolveSnapPointsToHeights(['auto', 480], 800, 100)
    const { heights: b } = resolveSnapPointsToHeights(['auto', 480], 800, 600)
    expect(a).toEqual([100, 480])
    // 'auto' grew past 480; resort puts auto last
    expect(b).toEqual([480, 600])
  })

  it("'auto' caps at the available viewport even if measured is taller", () => {
    const { heights } = resolveSnapPointsToHeights(['auto', 0.5], 600, 1500)
    // 'auto' clamped to 600, 0.5 -> 300
    expect(heights).toEqual([300, 600])
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
