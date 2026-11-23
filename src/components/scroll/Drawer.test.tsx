import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrawerProps, DrawerRef } from '../../types'
import { getLockCount } from '../../utils'
import { Drawer } from './Drawer'
import { nearestIndex, writeBackdropOpacity } from './geometry'

const VIEWPORT = 900
const TOP_INSET = 96

function scroller() {
  const el = document.querySelector<HTMLElement>('[data-scroll-drawer]')
  if (!el) throw new Error('scroller not rendered')
  return el
}

function settleAt(top: number) {
  const el = scroller()
  el.scrollTop = top
  fireEvent.scroll(el)
  fireEvent(el, new Event('scrollend'))
  vi.advanceTimersByTime(200)
}

function markers() {
  return [
    ...document.querySelectorAll<HTMLElement>('[data-scroll-drawer-marker]'),
  ].map((m) => m.style.getPropertyValue('--scroll-drawer-snap'))
}

function renderDrawer(
  props: Partial<DrawerProps> = {},
  ref?: React.Ref<DrawerRef>,
) {
  const onOpenChange = vi.fn()
  const utils = render(
    <Drawer
      ref={ref}
      open
      onOpenChange={onOpenChange}
      ariaLabel="Sheet"
      snapPoints={[200, 420]}
      {...props}
    >
      <Drawer.Content>
        <Drawer.Handle />
        <Drawer.Scrollable>
          <input aria-label="Search" />
        </Drawer.Scrollable>
      </Drawer.Content>
    </Drawer>,
  )
  return { onOpenChange, ...utils }
}

describe('scroll engine geometry', () => {
  it('picks the nearest position', () => {
    expect(nearestIndex(0, [200, 420, 600])).toBe(0)
    expect(nearestIndex(330, [200, 420, 600])).toBe(1)
    expect(nearestIndex(9999, [200, 420, 600])).toBe(2)
  })

  it('fades the backdrop across a scroll range', () => {
    const el = document.createElement('div')
    const backdrop = document.createElement('div')
    el.scrollTop = 100
    writeBackdropOpacity(el, backdrop, { start: 0, end: 200, min: 0 })
    expect(Number(backdrop.style.opacity)).toBe(0.5)
    el.scrollTop = 0
    writeBackdropOpacity(el, backdrop, { start: 0, end: 200, min: 0.4 })
    expect(Number(backdrop.style.opacity)).toBe(0.4)
    writeBackdropOpacity(el, backdrop, { start: 0, end: 0, min: 0 })
    expect(Number(backdrop.style.opacity)).toBe(1)
  })
})

describe('Drawer (scroll engine)', () => {
  const scrollTo = vi.fn(function (this: HTMLElement, opts: ScrollToOptions) {
    this.scrollTop = opts.top ?? 0
  })
  let clientHeight: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    scrollTo.mockClear()
    Element.prototype.scrollTo =
      scrollTo as unknown as typeof Element.prototype.scrollTo
    clientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight',
    )
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute('data-scroll-drawer') ? VIEWPORT : 0
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    if (clientHeight) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight)
    }
  })

  it('resolves fractions and tokens to px against the screen it opens on', () => {
    renderDrawer({ snapPoints: [0.5, 'full', 'screen', 480] })
    const available = VIEWPORT - TOP_INSET
    expect(markers()).toEqual([
      `${Math.round(available * 0.5)}px`,
      '480px',
      `${available}px`,
    ])
    const sheet = screen.getByRole('dialog')
    expect(sheet.style.height).toBe(`${VIEWPORT}px`)
    expect(
      document.querySelector<HTMLElement>('[data-scroll-drawer-spacer]')?.style
        .height,
    ).toBe(`${VIEWPORT}px`)
  })

  it('respects topInsetPx when resolving', () => {
    renderDrawer({ snapPoints: [0.5, 1], topInsetPx: 0 })
    expect(markers()).toEqual([`${VIEWPORT / 2}px`])
    expect(screen.getByRole('dialog').style.height).toBe(`${VIEWPORT}px`)
  })

  it('opens at the largest stop by default, or at defaultSnapPoint', async () => {
    vi.useRealTimers()
    const { unmount } = renderDrawer()
    await waitFor(() =>
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ top: 420 }),
      ),
    )
    unmount()
    renderDrawer({ defaultSnapPoint: 200 })
    await waitFor(() =>
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ top: 200 }),
      ),
    )
  })

  it('pins a non-dismissible sheet at its lowest stop and ignores Escape', () => {
    const onHeightChange = vi.fn()
    const { onOpenChange } = renderDrawer({
      dismissible: false,
      defaultSnapPoint: 200,
      onHeightChange,
    })
    expect(onHeightChange).toHaveBeenCalledWith(200)
    expect(
      document.querySelector<HTMLElement>('[data-scroll-drawer-spacer]')?.style
        .height,
    ).toBe(`${VIEWPORT - 200}px`)
    expect(scroller().scrollTop).toBe(0)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('drives stops from the ref and reports them', () => {
    const ref = createRef<DrawerRef>()
    const onSnapPointChange = vi.fn()
    renderDrawer({ snapPoints: [0.5, 'full'], onSnapPointChange }, ref)
    act(() => ref.current?.snapTo('full'))
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: VIEWPORT - TOP_INSET }),
    )
    settleAt(VIEWPORT - TOP_INSET)
    expect(onSnapPointChange).toHaveBeenLastCalledWith('full', 1)
    expect(ref.current?.getActiveSnapPoint()).toBe('full')
    expect(ref.current?.getHeight()).toBe(VIEWPORT - TOP_INSET)
    expect(scroller()).toHaveAttribute('data-scroll-drawer-full')

    act(() => ref.current?.collapse())
    settleAt(402)
    expect(onSnapPointChange).toHaveBeenLastCalledWith(0.5, 0)
    expect(scroller()).not.toHaveAttribute('data-scroll-drawer-full')

    act(() => ref.current?.snapTo(0.9))
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: VIEWPORT - TOP_INSET }),
    )
  })

  it('does not echo a parent-driven activeSnapPoint back', () => {
    const onSnapPointChange = vi.fn()
    const { rerender, onOpenChange } = renderDrawer({
      activeSnapPoint: 200,
      onSnapPointChange,
    })
    rerender(
      <Drawer
        open
        onOpenChange={onOpenChange}
        snapPoints={[200, 420]}
        activeSnapPoint={420}
        onSnapPointChange={onSnapPointChange}
      >
        <Drawer.Content />
      </Drawer>,
    )
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: 420 }),
    )
    settleAt(420)
    expect(onSnapPointChange).not.toHaveBeenCalledWith(420, 1)
  })

  it('renders an accessible modal dialog that locks the page', () => {
    renderDrawer({ title: 'Places', description: 'Nearby venues' })
    const dialog = screen.getByRole('dialog', { name: 'Places' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Nearby venues')
    expect(getLockCount()).toBe(1)
    expect(
      document.querySelector('[data-scroll-drawer-backdrop]'),
    ).not.toBeNull()
  })

  it('leaves the page usable when not modal', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    renderDrawer({ modal: false })
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false')
    expect(scroller()).toHaveAttribute('data-scroll-drawer-modeless')
    expect(document.querySelector('[data-scroll-drawer-backdrop]')).toBeNull()
    expect(getLockCount()).toBe(0)
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('leaves focus alone when focusTrap is off', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    renderDrawer({ focusTrap: false })
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('closes on Escape and the area above the sheet, but Escape clears a filled field first', () => {
    const { onOpenChange } = renderDrawer()
    const input = screen.getByRole('textbox', { name: 'Search' })
    fireEvent.change(input, { target: { value: 'pool' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    onOpenChange.mockClear()
    const spacer = document.querySelector('[data-scroll-drawer-spacer]')
    if (!spacer) throw new Error('spacer missing')
    fireEvent.click(spacer)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('dismisses when a scroll settles closed, and fires onClose', () => {
    const onClose = vi.fn()
    const { onOpenChange, rerender } = renderDrawer({ onClose })
    settleAt(0)
    expect(onOpenChange).not.toHaveBeenCalled()
    settleAt(420)
    settleAt(0)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    rerender(
      <Drawer open={false} onOpenChange={onOpenChange} onClose={onClose}>
        <Drawer.Content />
      </Drawer>,
    )
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-scroll-drawer]')).toBeNull()
  })

  it('works uncontrolled', () => {
    const ref = createRef<DrawerRef>()
    render(
      <Drawer ref={ref} defaultOpen snapPoints={[300]}>
        <Drawer.Content />
      </Drawer>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    act(() => ref.current?.dismiss())
    expect(document.querySelector('[data-scroll-drawer]')).toBeNull()
  })

  it('reports drags from touch sessions and the visible height', () => {
    const onDragStart = vi.fn()
    const onDragEnd = vi.fn()
    const onHeightChange = vi.fn()
    renderDrawer({ onDragStart, onDragEnd, onHeightChange })
    const el = scroller()
    fireEvent.touchStart(el, { touches: [{ clientY: 500 }] })
    el.scrollTop = 300
    fireEvent.scroll(el)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    fireEvent.touchEnd(el)
    settleAt(420)
    expect(onDragEnd).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ targetSnapPoint: 420, y: 420 }),
    )
    expect(onHeightChange).toHaveBeenLastCalledWith(420)
  })

  it('drags with a mouse from anywhere on the sheet except controls, past the slop', () => {
    const ref = createRef<DrawerRef>()
    render(
      <Drawer ref={ref} open snapPoints={[200, 420]} defaultSnapPoint={200}>
        <Drawer.Content>
          <p>Local Vibe</p>
          <button type="button">Open</button>
          <div data-drawer-drag>
            <button type="button">Filters</button>
            <input aria-label="Search" />
          </div>
        </Drawer.Content>
      </Drawer>,
    )
    const el = scroller()
    el.scrollTop = 200
    const mouse = { pointerType: 'mouse', button: 0, pointerId: 1 }
    const drag = (from: Element, dy: number, dx = 0) => {
      fireEvent.pointerDown(from, { ...mouse, clientX: 100, clientY: 600 })
      fireEvent.pointerMove(window, {
        ...mouse,
        clientX: 100 + dx / 2,
        clientY: 600 - dy / 2,
      })
      fireEvent.pointerMove(window, {
        ...mouse,
        clientX: 100 + dx,
        clientY: 600 - dy,
      })
      fireEvent.pointerUp(window, { ...mouse, clientY: 600 - dy })
    }

    drag(screen.getByRole('button', { name: 'Open' }), 150)
    expect(el.scrollTop).toBe(200)

    drag(screen.getByText('Local Vibe'), 2)
    expect(el.scrollTop).toBe(200)

    drag(screen.getByText('Local Vibe'), 40, 200)
    expect(el.scrollTop).toBe(200)

    drag(screen.getByText('Local Vibe'), 300)
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: 420 }),
    )

    const onClick = vi.fn()
    window.addEventListener('click', onClick)
    fireEvent.click(screen.getByText('Local Vibe'))
    expect(onClick).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    fireEvent.click(screen.getByText('Local Vibe'))
    expect(onClick).toHaveBeenCalledTimes(1)
    window.removeEventListener('click', onClick)

    el.scrollTop = 200
    drag(screen.getByRole('textbox', { name: 'Search' }), 300)
    expect(el.scrollTop).toBe(200)
    scrollTo.mockClear()
    drag(screen.getByRole('button', { name: 'Filters' }), 300)
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: 420 }),
    )
    vi.advanceTimersByTime(1)
  })

  it('keeps the backdrop full at every stop unless fadeFromIndex says otherwise', () => {
    const { unmount } = renderDrawer()
    const backdrop = () =>
      document.querySelector<HTMLElement>('[data-scroll-drawer-backdrop]')
    expect(backdrop()?.style.getPropertyValue('--scroll-drawer-fade-end')).toBe(
      '200px',
    )
    unmount()
    renderDrawer({ fadeFromIndex: 1 })
    expect(
      backdrop()?.style.getPropertyValue('--scroll-drawer-fade-start'),
    ).toBe('200px')
    expect(backdrop()?.style.getPropertyValue('--scroll-drawer-fade-end')).toBe(
      '420px',
    )
  })

  it('writes backdrop opacity on scroll when scroll timelines are unsupported', () => {
    vi.stubGlobal('CSS', { supports: () => false })
    renderDrawer()
    const el = scroller()
    el.scrollTop = 100
    fireEvent.scroll(el)
    const backdrop = document.querySelector<HTMLElement>(
      '[data-scroll-drawer-backdrop]',
    )
    expect(el.contains(backdrop)).toBe(false)
    expect(Number(backdrop?.style.opacity)).toBe(0.5)
    vi.unstubAllGlobals()
  })

  it('maps the remaining flags onto the scroller', () => {
    renderDrawer({
      snapToSequentialPoint: true,
      handleOnly: true,
      contentScroll: 'always',
      bottomInsetPx: 64,
    })
    const el = scroller()
    expect(el).toHaveAttribute('data-scroll-drawer-sequential')
    expect(el).toHaveAttribute('data-scroll-drawer-handle-only')
    expect(el).toHaveAttribute('data-scroll-drawer-content-scroll', 'always')
    expect(el.style.height).toBe('calc(100dvh - 64px)')
  })

  it('applies slots and keeps the v2 part attributes', () => {
    render(
      <Drawer
        open
        snapPoints={['full']}
        slots={{
          contentClassName: 'slot-content',
          handleClassName: 'slot-handle',
        }}
      >
        <Drawer.Content className="mine">
          <Drawer.Handle indicatorClassName="ind" />
          <Drawer.Scrollable>list</Drawer.Scrollable>
        </Drawer.Content>
      </Drawer>,
    )
    const content = document.querySelector('[data-drawer-content]')
    expect(content?.className).toMatch(/slot-content.*mine/)
    expect(document.querySelector('[data-drawer-handle]')?.className).toMatch(
      /slot-handle/,
    )
    expect(
      document.querySelector('[data-drawer-handle-indicator]')?.className,
    ).toMatch(/ind/)
    expect(document.querySelector('[data-drawer-scroll]')).toHaveAttribute(
      'data-scroll-drawer-content',
    )
  })
})
