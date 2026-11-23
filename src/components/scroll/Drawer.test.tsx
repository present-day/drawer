import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef, useRef, useState } from 'react'
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

  it('moves focus into a modal sheet without trapping it when focusTrap is off', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    const { unmount } = renderDrawer({ focusTrap: false })
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    outside.focus()
    expect(document.activeElement).toBe(outside)
    unmount()
    renderDrawer({ modal: false })
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('closes a modeless drawer on Escape only from inside it', () => {
    const { onOpenChange } = renderDrawer({ modal: false })
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  describe('a drawer opened from another, without a focus trap', () => {
    function Pair({
      childDismissible = true,
      keepOpener = true,
    }: {
      childDismissible?: boolean
      keepOpener?: boolean
    }) {
      const [parent, setParent] = useState(true)
      const [child, setChild] = useState(false)
      return (
        <>
          <button type="button">Page</button>
          <Drawer
            open={parent}
            onOpenChange={setParent}
            ariaLabel="Parent"
            focusTrap={false}
            snapPoints={[200, 420]}
          >
            <Drawer.Content>
              {keepOpener || !child ? (
                <button type="button" onClick={() => setChild(true)}>
                  Change
                </button>
              ) : null}
              <Drawer
                open={child}
                onOpenChange={setChild}
                ariaLabel="Child"
                focusTrap={false}
                dismissible={childDismissible}
                snapPoints={[200, 420]}
              >
                <Drawer.Content>
                  <input aria-label="City" />
                  <button type="button" onClick={() => setChild(false)}>
                    Close
                  </button>
                </Drawer.Content>
              </Drawer>
            </Drawer.Content>
          </Drawer>
        </>
      )
    }
    const dialog = (name: string) => screen.queryByRole('dialog', { name })
    const openChild = () => {
      const change = screen.getByRole('button', { name: 'Change' })
      act(() => change.focus())
      fireEvent.click(change)
      return change
    }
    const finishClosing = () => act(() => vi.advanceTimersByTime(1000))

    it('focuses the new sheet, then returns focus to its opener', () => {
      render(<Pair />)
      const change = openChild()
      expect(document.activeElement).toBe(dialog('Child'))
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(document.activeElement).toBe(change)
      finishClosing()
      expect(document.activeElement).toBe(change)
    })

    it('falls back to the sheet below when the opener is gone, then the body', () => {
      render(<Pair keepOpener={false} />)
      openChild()
      expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
      fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' })
      expect(document.activeElement).toBe(dialog('Parent'))
      fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' })
      expect(document.activeElement).toBe(document.body)
    })

    it('leaves focus the user moved elsewhere', () => {
      render(<Pair />)
      openChild()
      const page = screen.getByRole('button', { name: 'Page' })
      act(() => page.focus())
      fireEvent.keyDown(page, { key: 'Escape' })
      expect(dialog('Child')).toBeNull()
      expect(document.activeElement).toBe(page)
    })

    it('sends Escape to the top drawer wherever focus is', () => {
      render(<Pair />)
      const change = openChild()
      act(() => change.focus())
      fireEvent.keyDown(change, { key: 'Escape' })
      finishClosing()
      expect(dialog('Child')).toBeNull()
      expect(dialog('Parent')).not.toBeNull()
    })

    it('ignores Escape when the top drawer is not dismissible, or a field still has text', () => {
      const { unmount } = render(<Pair childDismissible={false} />)
      openChild()
      fireEvent.keyDown(document.body, { key: 'Escape' })
      finishClosing()
      expect(dialog('Child')).not.toBeNull()
      expect(dialog('Parent')).not.toBeNull()
      unmount()

      render(<Pair />)
      openChild()
      const city = screen.getByRole('textbox', { name: 'City' })
      fireEvent.change(city, { target: { value: 'Lisbon' } })
      fireEvent.keyDown(city, { key: 'Escape' })
      expect(dialog('Child')).not.toBeNull()
      const claimed = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      claimed.preventDefault()
      document.body.dispatchEvent(claimed)
      expect(dialog('Child')).not.toBeNull()
    })
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

  it('reports drags from touch sessions, y as the drag delta at release, and the visible height', () => {
    const onDragStart = vi.fn()
    const onDragEnd = vi.fn()
    const onHeightChange = vi.fn()
    renderDrawer({ onDragStart, onDragEnd, onHeightChange })
    const el = scroller()
    el.scrollTop = 420
    fireEvent.touchStart(el, { touches: [{ clientY: 500 }] })
    el.scrollTop = 300
    fireEvent.scroll(el)
    expect(onDragStart).toHaveBeenCalledTimes(1)
    fireEvent.touchEnd(el)
    settleAt(200)
    expect(onDragEnd).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ targetSnapPoint: 200, y: 120 }),
    )
    expect(onHeightChange).toHaveBeenLastCalledWith(200)
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
      expect.objectContaining({ velocity: -2000, y: -100 }),
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

    it('paints the sheet surface behind the keyboard, below the scroller', () => {
      const surface = (style: React.CSSProperties) =>
        render(
          <Drawer open ariaLabel="City" snapPoints={[200, 420]}>
            <Drawer.Content style={style}>
              <input aria-label="City" />
            </Drawer.Content>
          </Drawer>,
        )
      const rect = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({ left: 16, width: 358 } as DOMRect)
      try {
        const { unmount } = surface({ backgroundColor: 'rgb(250, 250, 250)' })
        const fill = () => {
          const el = document.querySelector<HTMLElement>(
            '[data-scroll-drawer-keyboard-fill]',
          )
          if (!el) throw new Error('fill missing')
          return el
        }
        expect(fill().parentElement).toBe(scroller().parentElement)
        expect(getComputedStyle(fill()).display).toBe('none')
        settleAt(200)
        rect.mockClear()

        keyboard(KEYBOARD, 40)
        expect(getComputedStyle(fill()).display).toBe('block')
        expect(fill().style.top).toBe(`${40 + VIEWPORT - KEYBOARD}px`)
        expect(fill().style.left).toBe('16px')
        expect(fill().style.width).toBe('358px')
        expect(fill().style.background).toContain('rgb(250, 250, 250)')
        const sheetReads = () =>
          rect.mock.contexts.filter((c) => c === screen.getByRole('dialog'))
            .length
        expect(sheetReads()).toBe(1)

        keyboard(KEYBOARD + 20)
        expect(fill().style.top).toBe(`${VIEWPORT - KEYBOARD - 20}px`)
        expect(sheetReads()).toBe(1)

        keyboard(0)
        expect(getComputedStyle(fill()).display).toBe('none')
        unmount()

        surface({
          backgroundColor: 'transparent',
          ['--scroll-drawer-fill' as string]: 'rgb(1, 2, 3)',
        })
        settleAt(200)
        keyboard(KEYBOARD)
        expect(fill().style.background).toContain('rgb(1, 2, 3)')
      } finally {
        rect.mockRestore()
      }
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

  describe('touch on a modeless sheet', () => {
    const touch = (x: number, y: number) => [
      { identifier: 1, clientX: x, clientY: y },
    ]
    const start = (target: Element, x: number, y: number) =>
      fireEvent.touchStart(target, {
        touches: touch(x, y),
        changedTouches: touch(x, y),
      })
    /** Returns false when the drawer took the gesture (preventDefault). */
    const move = (target: Element, x: number, y: number) =>
      fireEvent.touchMove(target, {
        touches: touch(x, y),
        changedTouches: touch(x, y),
      })
    const end = (target: Element, x: number, y: number, type = 'touchEnd') =>
      fireEvent[type as 'touchEnd'](target, {
        touches: [],
        changedTouches: touch(x, y),
      })

    function renderModeless(props: Partial<DrawerProps> = {}) {
      const onPill = vi.fn()
      const utils = render(
        <Drawer
          open
          modal={false}
          ariaLabel="Explore"
          snapPoints={[120, 420]}
          defaultSnapPoint={120}
          {...props}
        >
          <Drawer.Content>
            <button type="button" onClick={onPill}>
              Nearby
            </button>
            <div data-testid="chips">Chips</div>
            <input aria-label="Where" />
            <Drawer.Scrollable>
              <p>Venue</p>
            </Drawer.Scrollable>
          </Drawer.Content>
        </Drawer>,
      )
      const el = scroller()
      el.scrollTop = 120
      return { el, onPill, ...utils }
    }

    it('drags the sheet open from a button, and reports the drag', () => {
      const onDragStart = vi.fn()
      const onDragEnd = vi.fn()
      const { el } = renderModeless({ onDragStart, onDragEnd })
      const pill = screen.getByRole('button', { name: 'Nearby' })
      start(pill, 100, 700)
      expect(move(pill, 100, 696)).toBe(true)
      expect(move(pill, 100, 690)).toBe(false)
      expect(el.scrollTop).toBe(130)
      expect(el).toHaveAttribute('data-scroll-drawer-dragging')
      fireEvent.scroll(el)
      expect(onDragStart).toHaveBeenCalledTimes(1)
      expect(move(pill, 100, 500)).toBe(false)
      expect(el.scrollTop).toBe(320)
      end(pill, 100, 500)
      expect(el).not.toHaveAttribute('data-scroll-drawer-dragging')
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ top: 420 }),
      )
      settleAt(420)
      expect(onDragEnd).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ targetSnapPoint: 420, y: -200 }),
      )
    })

    it('sends a flick to the next stop in its direction, but not when canceled', () => {
      const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
      const { el } = renderModeless()
      const pill = screen.getByRole('button', { name: 'Nearby' })
      const flick = (fromTop: number, dy: number, type = 'touchEnd') => {
        el.scrollTop = fromTop
        now.mockReturnValue(1000)
        start(pill, 100, 600)
        move(pill, 100, 600 + Math.sign(dy) * 10)
        now.mockReturnValue(1040)
        move(pill, 100, 600 + dy)
        end(pill, 100, 600 + dy, type)
      }
      flick(120, -60)
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ top: 420 }),
      )
      flick(420, 60)
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ top: 120 }),
      )
      flick(120, -60, 'touchCancel')
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ top: 120 }),
      )
      now.mockRestore()
      vi.advanceTimersByTime(1)
    })

    it('lets a tap click', () => {
      const { el, onPill } = renderModeless()
      const pill = screen.getByRole('button', { name: 'Nearby' })
      start(pill, 100, 700)
      expect(move(pill, 103, 695)).toBe(true)
      end(pill, 103, 695)
      fireEvent.click(pill)
      expect(onPill).toHaveBeenCalledTimes(1)
      expect(el.scrollTop).toBe(120)
      expect(scrollTo).not.toHaveBeenCalledWith(
        expect.objectContaining({ top: 420 }),
      )
    })

    it('leaves sideways swipes, fields, and a scrolled list to the browser', () => {
      const { el } = renderModeless()
      const chips = screen.getByTestId('chips')
      start(chips, 100, 600)
      expect(move(chips, 140, 595)).toBe(true)
      expect(move(chips, 160, 540)).toBe(true)
      end(chips, 160, 540)

      const field = screen.getByRole('textbox', { name: 'Where' })
      start(field, 100, 600)
      expect(move(field, 100, 500)).toBe(true)
      end(field, 100, 500)

      const venue = screen.getByText('Venue')
      const list = venue.closest<HTMLElement>('[data-drawer-scroll]')
      if (!list) throw new Error('list missing')
      list.scrollTop = 50
      start(venue, 100, 500)
      expect(move(venue, 100, 560)).toBe(true)
      end(venue, 100, 560)
      expect(el.scrollTop).toBe(120)

      list.scrollTop = 0
      start(venue, 100, 600)
      expect(move(venue, 100, 500)).toBe(false)
      end(venue, 100, 500)
      vi.advanceTimersByTime(1)

      settleAt(420)
      expect(el).toHaveAttribute('data-scroll-drawer-full')
      Object.defineProperty(list, 'scrollHeight', {
        configurable: true,
        value: 900,
      })
      start(venue, 100, 600)
      expect(move(venue, 100, 500)).toBe(true)
      end(venue, 100, 500)
      expect(el.scrollTop).toBe(420)
    })

    it('leaves touch on a modal sheet to native scrolling', () => {
      const { el } = renderModeless({ modal: true })
      const pill = screen.getByRole('button', { name: 'Nearby' })
      start(pill, 100, 700)
      expect(move(pill, 100, 600)).toBe(true)
      end(pill, 100, 600)
      expect(el.scrollTop).toBe(120)
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
