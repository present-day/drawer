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

    try {
      const el = document.createElement('div')
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
})
