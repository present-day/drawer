import { renderHook, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

import { DRAWER_SIZING } from '../constants'
import { useDrawerSnap } from './useDrawerSnap'

describe('useDrawerSnap (hook)', () => {
  it('exposes defaultIndex 0 when there are no snap heights', () => {
    const { result } = renderHook(() =>
      useDrawerSnap({
        sizing: [],
        viewportHeight: 800,
        topInsetPx: 0,
        defaultSnapPoint: 0.5,
        contentMeasureRef: { current: null },
      }),
    )
    expect(result.current.snapHeights).toEqual([])
    expect(result.current.defaultIndex).toBe(0)
  })

  it('returns null from indexToRawValue for an out-of-range index', () => {
    const { result } = renderHook(() =>
      useDrawerSnap({
        sizing: [0.2, 0.4, 0.6],
        viewportHeight: 800,
        topInsetPx: 0,
        contentMeasureRef: { current: null },
      }),
    )
    expect(result.current.indexToRawValue(999)).toBeNull()
  })

  it('finds a snap index for a raw snap point', () => {
    const { result } = renderHook(() =>
      useDrawerSnap({
        sizing: [0.25, 0.75],
        viewportHeight: 800,
        topInsetPx: 0,
        contentMeasureRef: { current: null },
      }),
    )
    const idx0 = result.current.resolveSnapToIndex(0.25)
    const idx1 = result.current.resolveSnapToIndex(0.75)
    expect(idx0).toBe(0)
    expect(idx1).toBe(1)
  })

  it('wires AUTO sizing to ResizeObserver on the content element', async () => {
    const prevRo = globalThis.ResizeObserver
    const Obs = class {
      _cb: ResizeObserverCallback
      constructor(cb: ResizeObserverCallback) {
        this._cb = cb
      }
      observe() {
        this._cb(
          [{ contentRect: { height: 200 } } as unknown as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        )
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = Obs

    const el = document.createElement('div')
    const child = document.createElement('div')
    child.style.height = '200px'
    // JSDOM: layout height is 0 without explicit getters
    Object.defineProperty(child, 'offsetHeight', {
      configurable: true,
      get: () => 200,
    })
    el.appendChild(child)
    document.body.appendChild(el)
    try {
      const ref = createRef<HTMLDivElement | null>()
      ref.current = el

      const { result } = renderHook(() =>
        useDrawerSnap({
          sizing: DRAWER_SIZING.AUTO,
          viewportHeight: 800,
          topInsetPx: 0,
          contentMeasureRef: ref,
        }),
      )

      await waitFor(() => {
        expect(result.current.snapHeights[0]).toBeGreaterThan(0)
      })
    } finally {
      el.remove()
      globalThis.ResizeObserver = prevRo
    }
  })

  it('defaultIndex is the last snap when defaultSnapPoint is omitted', () => {
    const { result } = renderHook(() =>
      useDrawerSnap({
        sizing: [0.1, 0.3, 0.5],
        viewportHeight: 800,
        topInsetPx: 0,
        contentMeasureRef: { current: null },
      }),
    )
    const n = result.current.snapHeights.length
    expect(n).toBeGreaterThan(1)
    expect(result.current.defaultIndex).toBe(n - 1)
  })

  it('does not start ResizeObserver when the measure ref is null (AUTO)', () => {
    const { result } = renderHook(() =>
      useDrawerSnap({
        sizing: DRAWER_SIZING.AUTO,
        viewportHeight: 800,
        topInsetPx: 0,
        contentMeasureRef: { current: null },
      }),
    )
    expect(result.current.snapHeights.length).toBe(1)
  })

  // Regression: when the drawer mounts closed (open=false → true), the
  // measure element does not exist on the first effect pass. The hook must
  // re-bind observers once the element attaches; otherwise AUTO stays stuck
  // on the fallback height forever and async content cannot grow the sheet.
  it('rebinds AUTO measurement when measureAttachGeneration changes after a null ref', async () => {
    const prevRo = globalThis.ResizeObserver
    const Obs = class {
      _cb: ResizeObserverCallback
      constructor(cb: ResizeObserverCallback) {
        this._cb = cb
      }
      observe() {
        this._cb(
          [{ contentRect: { height: 320 } } as unknown as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        )
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = Obs

    try {
      const ref = createRef<HTMLDivElement | null>()

      const el = document.createElement('div')
      Object.defineProperty(el, 'scrollHeight', {
        configurable: true,
        value: 320,
      })
      Object.defineProperty(el, 'offsetHeight', {
        configurable: true,
        value: 320,
      })

      const { result, rerender } = renderHook(
        ({ gen }: { gen: number }) =>
          useDrawerSnap({
            sizing: DRAWER_SIZING.AUTO,
            viewportHeight: 800,
            topInsetPx: 0,
            contentMeasureRef: ref,
            measureAttachGeneration: gen,
          }),
        { initialProps: { gen: 0 } },
      )

      expect(result.current.snapHeights[0]).toBeLessThan(320)

      ref.current = el
      rerender({ gen: 1 })

      await waitFor(() => {
        expect(result.current.snapHeights[0]).toBe(320)
      })
    } finally {
      globalThis.ResizeObserver = prevRo
    }
  })
})
