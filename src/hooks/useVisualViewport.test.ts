import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  emitVisualViewportEvent,
  setVisualViewportSize,
  testVisualViewport,
} from '../test/vv-mock'
import { useVisualViewport } from './useVisualViewport'

describe('useVisualViewport', () => {
  it('exposes size from visual viewport after resize and reports keyboard height', async () => {
    const onViewportChange = vi.fn()
    setVisualViewportSize(700, 10)

    const { result } = renderHook(() =>
      useVisualViewport({ onViewportChange, enabled: true }),
    )

    act(() => {
      emitVisualViewportEvent('resize')
    })

    await waitFor(() => {
      expect(result.current.height).toBe(700)
      expect(result.current.offsetTop).toBe(10)
    })

    // innerHeight=900 in test setup → 900 - 700 - 10
    expect(result.current.layoutBottomInset).toBe(190)
    expect(result.current.availableHeight).toBe(700)
    expect(onViewportChange).toHaveBeenCalled()
  })

  it('is a no-op when visualViewport is missing', () => {
    const original = window.visualViewport
    Object.defineProperty(window, 'visualViewport', {
      value: null,
      configurable: true,
    })
    const { result } = renderHook(() => useVisualViewport())
    try {
      expect(result.current.height).toBe(0)
    } finally {
      Object.defineProperty(window, 'visualViewport', {
        value: original,
        configurable: true,
      })
    }
  })

  it('resets to defaults when disabled', () => {
    setVisualViewportSize(900, 0)
    const { result, rerender } = renderHook(
      (props: { enabled: boolean }) =>
        useVisualViewport({ enabled: props.enabled }),
      { initialProps: { enabled: true } },
    )

    act(() => {
      emitVisualViewportEvent('resize')
    })

    rerender({ enabled: false })

    expect(result.current.height).toBe(0)
    expect(result.current.availableHeight).toBe(0)
    expect(result.current.layoutBottomInset).toBe(0)
  })

  it('is a no-op in update() when still disabled (covers early return in update callback)', () => {
    setVisualViewportSize(900, 0)
    const { result } = renderHook(() => useVisualViewport({ enabled: false }))

    act(() => {
      emitVisualViewportEvent('resize')
    })

    expect(result.current.height).toBe(0)
  })

  it('skips state update when dimensions are unchanged', async () => {
    setVisualViewportSize(500, 0)
    const { result } = renderHook(() => useVisualViewport())
    act(() => {
      emitVisualViewportEvent('resize')
    })
    await waitFor(() => expect(result.current.height).toBe(500))
    const first = result.current
    act(() => {
      emitVisualViewportEvent('resize')
    })
    await waitFor(() => {
      expect(result.current.height).toBe(500)
    })
    expect(result.current).toBe(first)
  })

  it('applies readings synchronously — no rAF latency between event and state', () => {
    setVisualViewportSize(900, 0)
    const { result } = renderHook(() => useVisualViewport())

    // The keyboard is already animating when the event fires; a deferred
    // reading adds a frame of trailing gap on top of any interpolation.
    act(() => {
      setVisualViewportSize(500, 0)
    })
    expect(result.current.height).toBe(500)
    expect(result.current.layoutBottomInset).toBe(400)
    expect(result.current.isKeyboardOpen).toBe(true)
  })

  it('updates from scroll-only changes (iOS moves offsetTop without a resize)', () => {
    setVisualViewportSize(700, 0)
    const { result } = renderHook(() => useVisualViewport())
    act(() => {
      emitVisualViewportEvent('resize')
    })
    expect(result.current.layoutBottomInset).toBe(200)

    act(() => {
      testVisualViewport.offsetTop = 60
      emitVisualViewportEvent('scroll')
    })
    expect(result.current.offsetTop).toBe(60)
    expect(result.current.layoutBottomInset).toBe(140)
  })

  it('forces the inset to 0 below the keyboard threshold (stale iOS reading self-heals)', () => {
    const { result } = renderHook(() => useVisualViewport())

    // Full keyboard cycle: open...
    act(() => {
      setVisualViewportSize(500, 0)
    })
    expect(result.current.layoutBottomInset).toBe(400)

    // ...dismissed, but the viewport never returns exactly to the layout
    // height (residual 20px + offsetTop 10). keyboardHeight (20) is below the
    // 50px threshold, so this is not a keyboard: the inset must be 0, not the
    // stale arithmetic (900 - 880 - 10 = 10... or worse with offsetTop 0).
    act(() => {
      setVisualViewportSize(880, 10)
    })
    expect(result.current.isKeyboardOpen).toBe(false)
    expect(result.current.layoutBottomInset).toBe(0)
  })

  describe('when iOS shrinks innerHeight with the keyboard and pans the page', () => {
    // iPhone, iOS 18.7: frames t49242 and t51512 of a logged session.
    const innerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    const innerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    const setInnerHeight = (value: number) =>
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value,
      })
    const setInnerWidth = (value: number) =>
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value,
      })
    let field: HTMLInputElement

    beforeEach(() => {
      // A width no other test uses, so the baseline starts from this page.
      setInnerWidth(390)
      setInnerHeight(695)
      setVisualViewportSize(695, 0)
      field = document.createElement('input')
      document.body.append(field)
    })

    afterEach(() => {
      field.remove()
      if (innerHeight) Object.defineProperty(window, 'innerHeight', innerHeight)
      if (innerWidth) Object.defineProperty(window, 'innerWidth', innerWidth)
    })

    it('measures the keyboard from the height before it opened', () => {
      const { result } = renderHook(() => useVisualViewport())
      act(() => {
        field.focus()
        setInnerHeight(392)
        setVisualViewportSize(392, 303)
      })
      expect(result.current.isKeyboardOpen).toBe(true)
      expect(result.current.keyboardHeight).toBe(303)
      expect(result.current.offsetTop).toBe(303)
      expect(result.current.layoutBottomInset).toBe(0)

      act(() => {
        setInnerHeight(695)
        setVisualViewportSize(695, 0)
      })
      expect(result.current.isKeyboardOpen).toBe(false)
    })

    it('does not read a toolbar that shrinks the page as a keyboard', () => {
      const { result } = renderHook(() => useVisualViewport())
      act(() => {
        setInnerHeight(610)
        setVisualViewportSize(610, 0)
      })
      expect(result.current.isKeyboardOpen).toBe(false)
      expect(result.current.keyboardHeight).toBe(0)
    })

    it('starts over when the width changes', () => {
      const { result } = renderHook(() => useVisualViewport())
      act(() => {
        setInnerWidth(844)
        setInnerHeight(390)
        field.focus()
        setVisualViewportSize(390, 0)
      })
      expect(result.current.isKeyboardOpen).toBe(false)
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })
})
