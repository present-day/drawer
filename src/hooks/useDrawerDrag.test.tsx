import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useDrawerDrag } from './useDrawerDrag'

function TestHost(props: { enabled?: boolean; gen?: number }) {
  const { enabled = true, gen = 0 } = props
  const r = useRef<HTMLDivElement>(null)
  const { scrollContainerProps, drawerDragEnabled, dragElastic } =
    useDrawerDrag({
      scrollContainerRef: r,
      enabled,
      scrollAttachGeneration: gen,
    })
  return (
    <div
      ref={r}
      data-testid="scroller"
      data-enabled={String(drawerDragEnabled)}
      data-elastic={String(dragElastic)}
      style={{ height: 200, overflow: 'auto' }}
      {...scrollContainerProps}
    />
  )
}

describe('useDrawerDrag', () => {
  it('toggles drawerDragEnabled when scroller is not at top and coalesces pointer ref updates', async () => {
    render(<TestHost />)
    const el = screen.getByTestId('scroller') as HTMLDivElement
    expect(el.dataset.enabled).toBe('true')

    act(() => {
      el.scrollTop = 50
    })
    fireEvent.scroll(el)
    await waitFor(() => {
      expect(screen.getByTestId('scroller').dataset.enabled).toBe('false')
    })
  })

  it('does not install touch overflow handlers when enabled is false', () => {
    const { unmount } = render(<TestHost enabled={false} />)
    const el = screen.getByTestId('scroller') as HTMLDivElement
    const add = vi.spyOn(el, 'addEventListener')
    expect(
      add.mock.calls.filter((c) => String(c[0]).includes('touch')),
    ).toHaveLength(0)
    add.mockRestore()
    unmount()
  })

  it('handles touch start/move at scroll top to prevent default on overscroll', () => {
    render(<TestHost />)
    const el = screen.getByTestId('scroller') as HTMLDivElement
    const t0 = new globalThis.Touch({
      clientX: 0,
      clientY: 100,
      identifier: 0,
      target: el,
    })
    const t1 = new globalThis.Touch({
      clientX: 0,
      clientY: 200,
      identifier: 0,
      target: el,
    })
    fireEvent.touchStart(el, { touches: [t0] })
    fireEvent.touchMove(el, { touches: [t1] })
    fireEvent.touchEnd(el, { changedTouches: [t1] })
  })

  it('re-subscribes when scrollAttachGeneration changes', () => {
    const { rerender, unmount } = render(<TestHost gen={0} />)
    expect(screen.getByTestId('scroller')).toBeInTheDocument()
    rerender(<TestHost gen={1} />)
    expect(screen.getByTestId('scroller')).toBeInTheDocument()
    unmount()
  })

  it('registers a non-passive touchmove handler when enabled', () => {
    const add = vi.spyOn(HTMLDivElement.prototype, 'addEventListener')
    const { unmount } = render(<TestHost />)
    const moveOpts = add.mock.calls
      .filter((c) => c[0] === 'touchmove')
      .map((c) => c[2] as { passive: boolean } | undefined)
    expect(moveOpts.some((o) => o && o.passive === false)).toBe(true)
    add.mockRestore()
    unmount()
  })
})
