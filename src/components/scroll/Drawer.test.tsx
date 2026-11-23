import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDrawerKeyboardSnapMobile } from '../../hooks/useDrawerKeyboardSnapMobile'
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
    writeBackdropOpacity(el, backdrop, { start: 0, end: 200, min: 0, max: 1 })
    expect(Number(backdrop.style.opacity)).toBe(0.5)
    writeBackdropOpacity(el, backdrop, { start: 0, end: 200, min: 0, max: 0.3 })
    expect(Number(backdrop.style.opacity)).toBe(0.15)
    el.scrollTop = 0
    writeBackdropOpacity(el, backdrop, { start: 0, end: 200, min: 0.4, max: 1 })
    expect(Number(backdrop.style.opacity)).toBe(0.4)
    writeBackdropOpacity(el, backdrop, {
      start: 0,
      end: 200,
      min: 0.4,
      max: 0.3,
    })
    expect(Number(backdrop.style.opacity)).toBe(0.3)
    writeBackdropOpacity(el, backdrop, { start: 0, end: 0, min: 0, max: 1 })
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

  it('unlocks the list from contentScrollFrom instead of the top stop', () => {
    renderDrawer({ snapPoints: [200, 420, 'screen'], contentScrollFrom: 420 })
    settleAt(200)
    expect(scroller()).not.toHaveAttribute('data-scroll-drawer-full')
    settleAt(420)
    expect(scroller()).toHaveAttribute('data-scroll-drawer-full')
    settleAt(VIEWPORT)
    expect(scroller()).toHaveAttribute('data-scroll-drawer-full')
  })

  it('lays content out for the stop it opens at', () => {
    const { unmount } = renderDrawer()
    expect(scroller().style.getPropertyValue('--scroll-drawer-hidden')).toBe(
      '0px',
    )
    unmount()
    renderDrawer({ defaultSnapPoint: 200 })
    expect(scroller().style.getPropertyValue('--scroll-drawer-hidden')).toBe(
      '220px',
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

  it('reports drag velocity in px/s, positive downward, frozen at release', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    const onDrag = vi.fn()
    const onDragEnd = vi.fn()
    renderDrawer({ onDrag, onDragEnd })
    const el = scroller()
    el.scrollTop = 420
    const swipe = (path: [number, number][], releaseAt: number) => {
      now.mockReturnValue(1000)
      fireEvent.touchStart(el, { touches: [{ clientY: 500 }] })
      for (const [t, top] of path) {
        now.mockReturnValue(t)
        el.scrollTop = top
        fireEvent.scroll(el)
      }
      now.mockReturnValue(releaseAt)
      fireEvent.touchEnd(el)
    }

    swipe(
      [
        [1050, 370],
        [1080, 340],
      ],
      1080,
    )
    now.mockReturnValue(1400)
    settleAt(200)
    expect(onDragEnd).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ velocity: 1000, targetSnapPoint: 200 }),
    )

    swipe(
      [
        [1040, 260],
        [1060, 300],
      ],
      1060,
    )
    settleAt(420)
    expect(onDragEnd.mock.lastCall?.[1].velocity).toBeCloseTo(
      (-100 / 60) * 1000,
    )

    swipe([[1020, 400]], 1300)
    settleAt(420)
    expect(onDragEnd.mock.lastCall?.[1].velocity).toBe(0)
    now.mockRestore()
  })

  it('measures mouse drag velocity where it writes scrollTop', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    const onDragEnd = vi.fn()
    renderDrawer({ onDragEnd, defaultSnapPoint: 200 })
    const el = scroller()
    el.scrollTop = 200
    const mouse = { pointerType: 'mouse', button: 0, pointerId: 1 }
    fireEvent.pointerDown(screen.getByRole('dialog'), {
      ...mouse,
      clientX: 100,
      clientY: 600,
    })
    fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 580 })
    now.mockReturnValue(1050)
    fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 480 })
    fireEvent.scroll(el)
    fireEvent.pointerUp(window, { ...mouse, clientY: 480 })
    settleAt(420)
    expect(onDragEnd).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ velocity: -2000 }),
    )
    vi.advanceTimersByTime(1)
    now.mockRestore()
  })

  describe('software keyboard', () => {
    const KEYBOARD = 300
    let vv: EventTarget & { height: number; offsetTop: number }
    let observers: (() => void)[]

    const keyboard = (height: number, offsetTop = 0) => {
      vv.height = VIEWPORT - height
      vv.offsetTop = offsetTop
      act(() => {
        vv.dispatchEvent(new Event('resize'))
      })
    }
    const resize = () =>
      act(() => {
        for (const cb of observers) cb()
      })

    beforeEach(() => {
      vv = Object.assign(new EventTarget(), { height: VIEWPORT, offsetTop: 0 })
      vi.stubGlobal('visualViewport', vv)
      vi.stubGlobal('innerHeight', VIEWPORT)
      observers = []
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: () => void) {
            observers.push(cb)
          }
          observe() {}
          disconnect() {}
        },
      )
      // The scroller tracks the visual viewport while the keyboard is up.
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get(this: HTMLElement) {
          if (!this.hasAttribute('data-scroll-drawer')) return 0
          return this.hasAttribute('data-scroll-drawer-keyboard')
            ? vv.height
            : VIEWPORT
        },
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('rides the sheet up with the keyboard without moving its stops', () => {
      const ref = createRef<DrawerRef>()
      const onSnapPointChange = vi.fn()
      const onViewportChange = vi.fn()
      renderDrawer({ onSnapPointChange, onViewportChange }, ref)
      settleAt(200)
      onSnapPointChange.mockClear()
      const before = markers()
      const el = scroller()

      keyboard(KEYBOARD, 40)
      expect(el).toHaveAttribute('data-scroll-drawer-keyboard')
      expect(el.style.getPropertyValue('--scroll-drawer-keyboard-height')).toBe(
        `${VIEWPORT - KEYBOARD}px`,
      )
      expect(el.style.getPropertyValue('--scroll-drawer-keyboard-top')).toBe(
        '40px',
      )
      expect(el.scrollTop).toBe(200 + KEYBOARD)
      expect(onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isKeyboardOpen: true }),
      )

      resize()
      settleAt(el.scrollTop)
      expect(markers()).toEqual(before)
      expect(onSnapPointChange).not.toHaveBeenCalled()
      expect(ref.current?.getActiveSnapPoint()).toBe(200)
      expect(ref.current?.getHeight()).toBe(200)

      act(() => ref.current?.snapTo(420))
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ top: 420 + KEYBOARD }),
      )
      settleAt(420 + KEYBOARD)
      expect(onSnapPointChange).toHaveBeenLastCalledWith(420, 1)

      keyboard(0)
      expect(el).not.toHaveAttribute('data-scroll-drawer-keyboard')
      expect(el.scrollTop).toBe(420)
      resize()
      expect(markers()).toEqual(before)
    })

    it('works with useDrawerKeyboardSnapMobile', () => {
      function Sheet() {
        const ref = useRef<DrawerRef>(null)
        const onViewportChange = useDrawerKeyboardSnapMobile({
          open: true,
          isMobile: true,
          drawerRef: ref,
        })
        return (
          <Drawer
            ref={ref}
            open
            ariaLabel="Sheet"
            snapPoints={[200, 'full']}
            onViewportChange={onViewportChange}
          >
            <Drawer.Content>
              <input aria-label="Search" />
            </Drawer.Content>
          </Drawer>
        )
      }
      render(<Sheet />)
      settleAt(200)
      keyboard(KEYBOARD)
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ top: VIEWPORT - TOP_INSET }),
      )
      settleAt(VIEWPORT - TOP_INSET)
      keyboard(0)
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ top: 200 }),
      )
    })

    it('stops lifting at the top inset', () => {
      const ref = createRef<DrawerRef>()
      renderDrawer({ snapPoints: [200, 700] }, ref)
      settleAt(700)
      keyboard(KEYBOARD)
      expect(scroller().scrollTop).toBe(VIEWPORT - TOP_INSET)
      settleAt(scroller().scrollTop)
      expect(ref.current?.getActiveSnapPoint()).toBe(700)
      keyboard(0)
      expect(scroller().scrollTop).toBe(700)
    })

    it('keeps the focused field in view and never shrinks content while typing', () => {
      let listHeight = 500
      const scrollHeight = Object.getOwnPropertyDescriptor(
        Element.prototype,
        'scrollHeight',
      )
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        get(this: HTMLElement) {
          return this.hasAttribute('data-drawer-scroll') ? listHeight : 0
        },
      })
      const scrollIntoView = vi.fn()
      HTMLElement.prototype.scrollIntoView = scrollIntoView
      try {
        renderDrawer({ snapPoints: [200, 'auto'] })
        const sheet = screen.getByRole('dialog')
        expect(sheet.style.height).toBe('500px')
        settleAt(200)
        act(() => screen.getByRole('textbox', { name: 'Search' }).focus())

        keyboard(KEYBOARD)
        expect(scrollIntoView).toHaveBeenCalledTimes(1)
        keyboard(KEYBOARD + 20)
        expect(scrollIntoView).toHaveBeenCalledTimes(1)
        expect(scroller().scrollTop).toBe(200 + KEYBOARD + 20)

        listHeight = 300
        resize()
        expect(sheet.style.height).toBe('500px')
        listHeight = 600
        resize()
        expect(sheet.style.height).toBe('600px')
        expect(scroller().scrollTop).toBe(200 + KEYBOARD + 20)

        listHeight = 300
        keyboard(0)
        resize()
        expect(sheet.style.height).toBe('300px')
      } finally {
        // @ts-expect-error jsdom has no scrollIntoView
        delete HTMLElement.prototype.scrollIntoView
        delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight
        if (scrollHeight) {
          Object.defineProperty(Element.prototype, 'scrollHeight', scrollHeight)
        }
      }
    })
  })

  it('leaves an outer sheet alone when a drawer opened from it is dragged', () => {
    render(
      <Drawer open ariaLabel="Outer" snapPoints={[200, 420]}>
        <Drawer.Content>
          <p>Outer</p>
          <Drawer open ariaLabel="Inner" snapPoints={[200, 420]}>
            <Drawer.Content>
              <p>Inner</p>
            </Drawer.Content>
          </Drawer>
        </Drawer.Content>
      </Drawer>,
    )
    const [outer, inner] = ['Outer', 'Inner'].map((name) =>
      screen
        .getByRole('dialog', { name })
        .closest<HTMLElement>('[data-scroll-drawer]'),
    )
    if (!outer || !inner) throw new Error('drawers not rendered')
    outer.scrollTop = 200
    inner.scrollTop = 200
    const mouse = { pointerType: 'mouse', button: 0, pointerId: 1 }
    fireEvent.pointerDown(screen.getByText('Inner'), {
      ...mouse,
      clientX: 100,
      clientY: 600,
    })
    fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 500 })
    fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 450 })
    expect(inner.scrollTop).toBe(250)
    expect(outer.scrollTop).toBe(200)
    fireEvent.pointerUp(window, { ...mouse, clientY: 450 })
    vi.advanceTimersByTime(1)
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
    expect(el.style.getPropertyValue('--scroll-drawer-bottom-inset')).toBe(
      '64px',
    )
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
