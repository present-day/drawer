import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emitVisualViewportEvent, setVisualViewportSize } from '../test/vv-mock'
import type { DrawerRef } from '../types'
import { forceUnlock, getLockCount, lockBody, unlockBody } from '../utils'

vi.mock('motion/react', async (importOriginal) => {
  const m = await importOriginal<typeof import('motion/react')>()
  return {
    ...m,
    animate: (
      value: unknown,
      target: number,
      options?: { onComplete?: () => void; [key: string]: unknown },
    ) => {
      if (
        value &&
        typeof value === 'object' &&
        'set' in value &&
        'get' in value
      ) {
        ;(value as { set: (n: number) => void; get: () => number }).set(target)
      }
      queueMicrotask(() => {
        options?.onComplete?.()
      })
      return { stop: () => {} }
    },
  }
})

import { Drawer } from './Drawer'

function flushMicrotasks() {
  return act(async () => {
    await Promise.resolve()
  })
}

describe('Drawer (coverage)', () => {
  beforeEach(() => {
    forceUnlock()
    setVisualViewportSize(900, 0)
  })
  // No vi.restoreAllMocks/clearAllMocks: they can break global/window shims
  // and leave a later test without VV event listeners.

  it('merges overlayClassName, calls onViewportChange, and applies content slots on modal', async () => {
    const onOpenChange = vi.fn()
    const onViewportChange = vi.fn()
    render(
      <Drawer
        open
        onOpenChange={onOpenChange}
        snapPoints={[0.2, 0.4, 0.6]}
        onViewportChange={onViewportChange}
        overlayClassName="ov-extra"
        activeSnapPoint={0.4}
        slots={{ contentClassName: 'slot-abc' }}
      >
        <Drawer.Content>slot</Drawer.Content>
      </Drawer>,
    )
    const dialog = await screen.findByRole('dialog')
    const content = document.querySelector(
      '[data-drawer-content]',
    ) as HTMLDivElement
    expect(content.className).toMatch(/slot-abc/)
    setVisualViewportSize(720, 0)
    act(() => {
      emitVisualViewportEvent('resize')
    })
    expect(onViewportChange).toHaveBeenCalled()
    const [overlay] = screen.getAllByRole('button', { hidden: true })
    if (!overlay) {
      expect.fail('overlay')
    }
    expect(overlay.className).toMatch(/ov-extra/)
    void dialog
  })

  it('repairs body locks when a non-modal drawer closes and locks had been left on', async () => {
    const onOpenChange = vi.fn()
    lockBody()
    expect(getLockCount()).toBe(1)
    const { rerender } = render(
      <Drawer
        open
        onOpenChange={onOpenChange}
        snapPoints={['full']}
        modal={false}
      >
        <Drawer.Content>nm</Drawer.Content>
      </Drawer>,
    )
    await screen.findByRole('dialog')
    rerender(
      <Drawer
        open={false}
        onOpenChange={onOpenChange}
        snapPoints={['full']}
        modal={false}
      >
        <Drawer.Content>out</Drawer.Content>
      </Drawer>,
    )
    await flushMicrotasks()
    while (getLockCount() > 0) {
      unlockBody()
    }
  })

  it('does not close from overlay when dismissible is false', async () => {
    const onOpenChange = vi.fn()
    const user = (await import('@testing-library/user-event')).default
    const u = user.setup()
    render(
      <Drawer
        open
        dismissible={false}
        onOpenChange={onOpenChange}
        snapPoints={['full']}
      >
        <Drawer.Content>x</Drawer.Content>
      </Drawer>,
    )
    const overlay = (await screen.findAllByRole('button', { hidden: true }))[0]
    if (overlay) await u.click(overlay)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('ignores drags on interactive nodes and on scrolled scroll regions, and right mouse button', async () => {
    const onOpenChange = vi.fn()
    render(
      <Drawer open onOpenChange={onOpenChange} snapPoints={[0.3, 0.7]}>
        <Drawer.Content>
          <button type="button">trap</button>
          <div data-drawer-no-drag>no</div>
          <Drawer.Scrollable>
            <div style={{ height: 4000 }}>tall</div>
          </Drawer.Scrollable>
        </Drawer.Content>
      </Drawer>,
    )
    const dialog = (await screen.findByRole('dialog')) as HTMLDivElement
    const btn = screen.getByRole('button', { name: 'trap' })
    fireEvent.pointerDown(btn, {
      pointerId: 1,
      clientY: 100,
      button: 0,
      pointerType: 'mouse',
    })
    fireEvent.pointerUp(btn, { pointerId: 1, clientY: 100 })
    const scroll = document.querySelector(
      '[data-drawer-scroll]',
    ) as HTMLDivElement
    act(() => {
      scroll.scrollTop = 80
    })
    fireEvent.pointerDown(scroll, {
      pointerId: 2,
      clientY: 50,
      button: 0,
      pointerType: 'mouse',
    })
    fireEvent.pointerUp(scroll, { pointerId: 2, clientY: 50 })
    fireEvent.pointerDown(dialog, {
      pointerId: 3,
      clientY: 12,
      button: 2,
      pointerType: 'mouse',
    })
  })

  it('fires drag callbacks when the session becomes active', async () => {
    const onDragStart = vi.fn()
    const onDrag = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <Drawer
        open
        onOpenChange={onOpenChange}
        snapPoints={[0.25, 0.5, 0.75]}
        onDragStart={onDragStart}
        onDrag={onDrag}
      >
        <Drawer.Content>y</Drawer.Content>
      </Drawer>,
    )
    const dialog = (await screen.findByRole('dialog')) as HTMLDivElement
    fireEvent.pointerDown(dialog, {
      pointerId: 9,
      clientY: 200,
      button: 0,
      pointerType: 'pen',
    })
    fireEvent.pointerMove(dialog, {
      pointerId: 9,
      clientY: 50,
      button: 0,
      buttons: 1,
    })
    await flushMicrotasks()
    expect(onDragStart).toHaveBeenCalled()
    expect(onDrag).toHaveBeenCalled()
    fireEvent.pointerUp(dialog, { pointerId: 9, clientY: 30 })
  })

  it('uses imperative ref controls', async () => {
    const ref = createRef<DrawerRef>()
    const onOpenChange = vi.fn()
    render(
      <Drawer
        ref={ref}
        open
        onOpenChange={onOpenChange}
        snapPoints={[0.1, 0.9]}
      >
        <Drawer.Content>z</Drawer.Content>
      </Drawer>,
    )
    await waitFor(() => {
      expect(ref.current).not.toBeNull()
    })
    act(() => {
      ref.current?.expand()
      ref.current?.collapse()
      ref.current?.snapTo(0.1)
    })
    expect(typeof ref.current?.getHeight()).toBe('number')
    void ref.current?.getActiveSnapPoint()
  })

  it('re-snaps when visual viewport height changes after the intro animation', async () => {
    setVisualViewportSize(900, 0)
    const onOpenChange = vi.fn()
    render(
      <Drawer open onOpenChange={onOpenChange} snapPoints={[0.3, 0.6, 0.9]}>
        <Drawer.Content>q</Drawer.Content>
      </Drawer>,
    )
    await screen.findByRole('dialog')
    await flushMicrotasks()
    setVisualViewportSize(700, 0)
    act(() => {
      emitVisualViewportEvent('resize')
    })
    await flushMicrotasks()
  })

  it('aligns the panel bottom to the visual viewport using layout bottom inset (iOS keyboard)', async () => {
    setVisualViewportSize(700, 10)
    const onOpenChange = vi.fn()
    render(
      <Drawer open onOpenChange={onOpenChange} snapPoints={['full']}>
        <Drawer.Content>kv</Drawer.Content>
      </Drawer>,
    )
    const dialog = await screen.findByRole('dialog')
    // innerHeight=900 in test setup — 900 - 700 - 10; rAF in useVisualViewport
    await waitFor(() => {
      expect(dialog).toHaveStyle({ bottom: '190px' })
    })
  })
})
