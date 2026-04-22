import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { emitVisualViewportEvent, setVisualViewportSize } from '../test/vv-mock'
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
    setVisualViewportSize(800, 0)
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
  })

  it('is a no-op in update() when still disabled (covers early return in update callback)', () => {
    setVisualViewportSize(800, 0)
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

  afterEach(() => {
    vi.clearAllMocks()
  })
})
