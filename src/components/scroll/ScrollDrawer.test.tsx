import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLockCount } from '../../utils'
import {
  nearestIndex,
  snapPositions,
  snapScrollTop,
  spacerHeight,
  stageOffset,
  writeBackdropOpacity,
} from './geometry'
import { ScrollDrawer, type ScrollDrawerProps } from './ScrollDrawer'

function setScrollMetrics(
  el: HTMLElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop?: number },
) {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    value: metrics.scrollHeight,
  })
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: metrics.clientHeight,
  })
  if (metrics.scrollTop !== undefined) el.scrollTop = metrics.scrollTop
}

function scroller() {
  const el = document.querySelector<HTMLElement>('[data-scroll-drawer]')
  if (!el) throw new Error('scroller not rendered')
  return el
}

function settleScroll(el: HTMLElement) {
  fireEvent.scroll(el)
  fireEvent(el, new Event('scrollend'))
  vi.advanceTimersByTime(200)
}

function renderDrawer(props: Partial<ScrollDrawerProps> = {}) {
  const onOpenChange = vi.fn()
  const utils = render(
    <ScrollDrawer
      open
      onOpenChange={onOpenChange}
      aria-label="Sheet"
      {...props}
    >
      <ScrollDrawer.Handle />
      <ScrollDrawer.Content>
        <button type="button">Inside</button>
      </ScrollDrawer.Content>
    </ScrollDrawer>,
  )
  return { onOpenChange, ...utils }
}

describe('scroll drawer geometry', () => {
  it('offsets the stage only when not dismissible', () => {
    expect(stageOffset([200, 420], true)).toBe(0)
    expect(stageOffset([420, 200], false)).toBe(200)
    expect(stageOffset([], false)).toBeNull()
  })

  it('sizes the spacer so scrollTop 0 shows exactly the offset', () => {
    expect(spacerHeight(0)).toBe('calc(100dvh - 0px)')
    expect(spacerHeight(200)).toBe('calc(100dvh - 200px)')
    expect(spacerHeight(null)).toBe('0px')
  })

  it('maps each snap point to the scrollTop that leaves that many px visible', () => {
    expect(snapScrollTop(200, 0)).toBe(200)
    expect(snapScrollTop(420, 200)).toBe(220)
    expect(snapScrollTop(200, 200)).toBe(0)
    expect(snapPositions([200, 420], 0, 600)).toEqual([200, 420, 600])
    expect(snapPositions([200, 900], 0, 600)).toEqual([200, 600, 600])
  })

  it('picks the nearest position', () => {
    expect(nearestIndex(0, [200, 420, 600])).toBe(0)
    expect(nearestIndex(330, [200, 420, 600])).toBe(1)
    expect(nearestIndex(9999, [200, 420, 600])).toBe(2)
  })

  it('writes backdrop opacity from scroll progress without React', () => {
    const el = document.createElement('div')
    const backdrop = document.createElement('div')
    setScrollMetrics(el, { scrollHeight: 1500, clientHeight: 900 })
    el.scrollTop = 150
    writeBackdropOpacity(el, backdrop)
    expect(Number(backdrop.style.opacity)).toBe(0.25)
    el.scrollTop = 0
    writeBackdropOpacity(el, backdrop, 0.4)
    expect(Number(backdrop.style.opacity)).toBe(0.4)
  })
})

describe('ScrollDrawer', () => {
  const scrollTo = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    scrollTo.mockReset()
    Element.prototype.scrollTo =
      scrollTo as unknown as typeof Element.prototype.scrollTo
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders an accessible modal dialog with snap markers', () => {
    renderDrawer({ snapPoints: [200, 420] })
    const dialog = screen.getByRole('dialog', { name: 'Sheet' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const markers = dialog.querySelectorAll<HTMLElement>(
      '[data-scroll-drawer-marker]',
    )
    expect(
      [...markers].map((m) => m.style.getPropertyValue('--scroll-drawer-snap')),
    ).toEqual(['200px', '420px'])
    expect(
      document.querySelector<HTMLElement>('[data-scroll-drawer-spacer]')?.style
        .height,
    ).toBe('calc(100dvh - 0px)')
    expect(document.getElementById('present-day-scroll-drawer')).not.toBeNull()
    expect(getLockCount()).toBe(1)
  })

  it('leaves the page usable when not modal', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    renderDrawer({ snapPoints: [200], modal: false })
    expect(screen.getByRole('dialog', { name: 'Sheet' })).toHaveAttribute(
      'aria-modal',
      'false',
    )
    expect(scroller()).toHaveAttribute('data-scroll-drawer-modeless')
    expect(document.querySelector('[data-scroll-drawer-backdrop]')).toBeNull()
    expect(getLockCount()).toBe(0)
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('scrolls to the first snap point after mount', async () => {
    vi.useRealTimers()
    renderDrawer({ snapPoints: [200, 420] })
    setScrollMetrics(scroller(), { scrollHeight: 1500, clientHeight: 900 })
    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ top: 200 }),
      ),
    )
  })

  it('closes on Escape and on the empty area above the sheet', () => {
    const { onOpenChange } = renderDrawer()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    onOpenChange.mockClear()
    const spacer = document.querySelector('[data-scroll-drawer-spacer]')
    if (!spacer) throw new Error('spacer missing')
    fireEvent.click(spacer)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('ignores Escape when not dismissible and offsets the stage', () => {
    const { onOpenChange } = renderDrawer({
      dismissible: false,
      snapPoints: [200, 420],
    })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(
      document.querySelector<HTMLElement>('[data-scroll-drawer-spacer]')?.style
        .height,
    ).toBe('calc(100dvh - 200px)')
  })

  it('dismisses when a scroll settles at the closed position', () => {
    const { onOpenChange } = renderDrawer()
    const el = scroller()
    setScrollMetrics(el, {
      scrollHeight: 1500,
      clientHeight: 900,
      scrollTop: 0,
    })
    settleScroll(el)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('reports snap changes and unlocks content scrolling when fully open', () => {
    const onSnapChange = vi.fn()
    renderDrawer({ snapPoints: [200, 420], onSnapChange })
    const el = scroller()
    setScrollMetrics(el, {
      scrollHeight: 1500,
      clientHeight: 900,
      scrollTop: 420,
    })
    settleScroll(el)
    expect(onSnapChange).toHaveBeenLastCalledWith(1)
    expect(el).not.toHaveAttribute('data-scroll-drawer-full')

    el.scrollTop = 600
    settleScroll(el)
    expect(onSnapChange).toHaveBeenLastCalledWith(2)
    expect(el).toHaveAttribute('data-scroll-drawer-full')
  })

  it('writes backdrop opacity on scroll when scroll timelines are unsupported', () => {
    vi.stubGlobal('CSS', { supports: () => false })
    renderDrawer()
    const el = scroller()
    setScrollMetrics(el, {
      scrollHeight: 1500,
      clientHeight: 900,
      scrollTop: 300,
    })
    fireEvent.scroll(el)
    const backdrop = document.querySelector<HTMLElement>(
      '[data-scroll-drawer-backdrop]',
    )
    expect(el.contains(backdrop)).toBe(false)
    expect(Number(backdrop?.style.opacity)).toBe(0.5)
    expect(el.style.getPropertyValue('--drawer-progress')).toBe('')
    vi.unstubAllGlobals()
  })

  it('unmounts and unlocks the body when closed from the closed position', () => {
    const { rerender, onOpenChange } = renderDrawer()
    rerender(<ScrollDrawer open={false} onOpenChange={onOpenChange} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(getLockCount()).toBe(0)
  })

  it('animates to closed before unmounting when open', () => {
    const { rerender, onOpenChange } = renderDrawer()
    const el = scroller()
    setScrollMetrics(el, {
      scrollHeight: 1500,
      clientHeight: 900,
      scrollTop: 600,
    })
    rerender(<ScrollDrawer open={false} onOpenChange={onOpenChange} />)
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: 0 }),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    el.scrollTop = 0
    settleScroll(el)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
