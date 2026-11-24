import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDrawerKeyboardSnapMobile } from '../../hooks/useDrawerKeyboardSnapMobile'
import type { DrawerProps, DrawerRef, SnapPoint } from '../../types'
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

/**
 * Gives the sheet a layout box: it sits below a spacer of `spacer` px and is
 * `height` tall, so at scrollTop t the part below the screen is
 * spacer + height - t - clientHeight.
 */
function stubSheetBox(height: number, spacer = VIEWPORT) {
  const top = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetTop',
  )
  const tall = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetHeight',
  )
  const isSheet = (el: HTMLElement) =>
    el.hasAttribute('data-scroll-drawer-sheet')
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get(this: HTMLElement) {
      return isSheet(this) ? spacer : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isSheet(this) ? height : 0
    },
  })
  return () => {
    if (top) Object.defineProperty(HTMLElement.prototype, 'offsetTop', top)
    if (tall) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', tall)
    }
  }
}

function hidden() {
  return scroller().style.getPropertyValue('--scroll-drawer-hidden')
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

  describe('stops that change while the sheet is entering', () => {
    const tree = (
      snapPoints: number[],
      props: Partial<DrawerProps> = {},
      ref?: React.Ref<DrawerRef>,
    ) => (
      <Drawer
        ref={ref}
        open
        ariaLabel="Sheet"
        snapPoints={snapPoints}
        {...props}
      >
        <Drawer.Content />
      </Drawer>
    )
    const frame = () =>
      act(() => new Promise<void>((r) => requestAnimationFrame(() => r())))

    it('heads for the new target before the entry starts', async () => {
      const ref = createRef<DrawerRef>()
      const { rerender } = render(tree([200, 420], {}, ref))
      rerender(tree([200, 500], {}, ref))
      expect(scroller().scrollTop).toBe(0)
      expect(scrollTo).not.toHaveBeenCalled()
      await frame()
      expect(scrollTo).toHaveBeenLastCalledWith({
        top: 500,
        behavior: 'smooth',
      })
      expect(ref.current?.getActiveSnapPoint()).toBe(500)
    })

    it('retargets an entry already scrolling, rather than jumping', async () => {
      const ref = createRef<DrawerRef>()
      // The entry scroll is still running, so scrollTop hasn't arrived.
      scrollTo.mockImplementation(() => {})
      try {
        const { rerender } = render(tree([200, 420], {}, ref))
        await frame()
        expect(scrollTo).toHaveBeenLastCalledWith({
          top: 420,
          behavior: 'smooth',
        })
        rerender(tree([200, 500], {}, ref))
        expect(scrollTo).toHaveBeenLastCalledWith({
          top: 500,
          behavior: 'smooth',
        })
        expect(scroller().scrollTop).toBe(0)
        expect(ref.current?.getActiveSnapPoint()).toBeNull()
      } finally {
        scrollTo.mockImplementation(function (
          this: HTMLElement,
          opts: ScrollToOptions,
        ) {
          this.scrollTop = opts.top ?? 0
        })
      }
    })

    it('lets a pinned sheet finish its slide', () => {
      const cancel = vi.fn()
      const animate = vi.fn(() => ({ cancel }) as unknown as Animation)
      HTMLElement.prototype.animate = animate
      try {
        const props = { dismissible: false, defaultSnapPoint: 200 }
        const { rerender } = render(tree([200, 420], props))
        expect(animate).toHaveBeenCalled()
        rerender(tree([250, 420], props))
        expect(cancel).not.toHaveBeenCalled()
      } finally {
        // @ts-expect-error happy-dom has no animate
        delete HTMLElement.prototype.animate
      }
    })
  })

  it('starts no animation for a stop the sheet is already at', () => {
    const onAnimationStart = vi.fn()
    const ref = createRef<DrawerRef>()
    function Parent() {
      const [active, setActive] = useState<SnapPoint>(200)
      return (
        <Drawer
          ref={ref}
          open
          ariaLabel="Sheet"
          snapPoints={[200, 420]}
          activeSnapPoint={active}
          onSnapPointChange={setActive}
          onAnimationStart={onAnimationStart}
        >
          <Drawer.Content />
        </Drawer>
      )
    }
    render(<Parent />)
    settleAt(200)
    onAnimationStart.mockClear()
    // A drag lands on 420 and the parent echoes it back.
    settleAt(420)
    act(() => ref.current?.snapTo(420))
    expect(onAnimationStart).not.toHaveBeenCalled()
    act(() => ref.current?.snapTo(200))
    expect(onAnimationStart).toHaveBeenCalledTimes(1)
  })

  it('lets go of a mouse drag when it closes with the button held', () => {
    const tree = (open: boolean) => (
      <Drawer open={open} ariaLabel="Sheet" snapPoints={[200, 420]}>
        <Drawer.Content />
      </Drawer>
    )
    const { rerender } = render(tree(true))
    settleAt(420)
    const el = scroller()
    const mouse = { pointerType: 'mouse', button: 0, pointerId: 1 }
    fireEvent.pointerDown(screen.getByRole('dialog'), {
      ...mouse,
      clientX: 100,
      clientY: 100,
    })
    fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 110 })
    fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 150 })
    expect(el).toHaveAttribute('data-scroll-drawer-dragging')
    const removed = vi.spyOn(window, 'removeEventListener')
    rerender(tree(false))
    expect(el).not.toHaveAttribute('data-scroll-drawer-dragging')
    expect(removed.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']),
    )
    removed.mockRestore()
    const before = el.scrollTop
    fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 400 })
    expect(el.scrollTop).toBe(before)
  })

  it('brings a swiped-down sheet back when the parent keeps it open', () => {
    const { onOpenChange } = renderDrawer()
    settleAt(420)
    scrollTo.mockClear()
    settleAt(0)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: 200 }),
    )
  })

  it('stays down when the parent closes it', () => {
    function Parent() {
      const [open, setOpen] = useState(true)
      return (
        <Drawer open={open} onOpenChange={setOpen} snapPoints={[200, 420]}>
          <Drawer.Content />
        </Drawer>
      )
    }
    render(<Parent />)
    settleAt(420)
    scrollTo.mockClear()
    settleAt(0)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('dismisses when a scroll settles closed, and fires onClose', () => {
    const onClose = vi.fn()
    const { onOpenChange, rerender } = renderDrawer({ onClose })
    settleAt(0)
    expect(onOpenChange).not.toHaveBeenCalled()
    settleAt(420)
    const el = scroller()
    el.scrollTop = 0
    fireEvent.scroll(el)
    fireEvent(el, new Event('scrollend'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    rerender(
      <Drawer open={false} onOpenChange={onOpenChange} onClose={onClose}>
        <Drawer.Content />
      </Drawer>,
    )
    vi.advanceTimersByTime(200)
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
    let observed: Element[]

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
      observed = []
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: () => void) {
            observers.push(cb)
          }
          observe(target: Element) {
            observed.push(target)
          }
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

    describe('when the keyboard comes up while the sheet is entering', () => {
      const sheetMax = () =>
        scroller().style.getPropertyValue('--scroll-drawer-keyboard-sheet-max')
      /** Furthest the scroller can scroll, from the track it lays out. */
      const maxScroll = (sheetHeight: number) =>
        VIEWPORT +
        Math.min(sheetHeight, Number.parseFloat(sheetMax())) -
        (VIEWPORT - KEYBOARD)

      it('defers the lift to the entry, so its stop survives', async () => {
        vi.useRealTimers()
        const ref = createRef<DrawerRef>()
        renderDrawer({ snapPoints: [300, 700] }, ref)
        const el = scroller()
        expect(el.scrollTop).toBe(0)
        keyboard(KEYBOARD)
        expect(el.scrollTop).toBe(0)
        // iOS reveals the focused field by scrolling the entering sheet.
        el.scrollTop = 250
        fireEvent.scroll(el)
        await waitFor(() =>
          expect(scrollTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ top: VIEWPORT - TOP_INSET }),
          ),
        )
        expect(ref.current?.getActiveSnapPoint()).toBe(700)
        expect(ref.current?.getHeight()).toBe(700)
        expect(maxScroll(700)).toBeLessThanOrEqual(VIEWPORT - TOP_INSET)
        keyboard(0)
        expect(el.scrollTop).toBe(700)
        expect(sheetMax()).toBe('')
      })

      it('lifts once the entry settles, wherever a focus scroll left it', async () => {
        vi.useRealTimers()
        const scrollIntoView = vi.fn()
        HTMLElement.prototype.scrollIntoView = scrollIntoView
        try {
          scrollTo.mockImplementationOnce(() => {})
          const ref = createRef<DrawerRef>()
          renderDrawer({ snapPoints: [300, 700] }, ref)
          const el = scroller()
          await waitFor(() => expect(scrollTo).toHaveBeenCalled())
          act(() => screen.getByRole('textbox', { name: 'Search' }).focus())
          keyboard(KEYBOARD)
          expect(el.scrollTop).toBe(0)
          expect(scrollIntoView).not.toHaveBeenCalled()
          expect(sheetMax()).toBe(`${VIEWPORT - KEYBOARD - TOP_INSET}px`)

          el.scrollTop = 760
          fireEvent.scroll(el)
          fireEvent(el, new Event('scrollend'))
          expect(scrollTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ top: VIEWPORT - TOP_INSET }),
          )
          fireEvent(el, new Event('scrollend'))
          expect(ref.current?.getActiveSnapPoint()).toBe(700)
          keyboard(0)
          expect(el.scrollTop).toBe(700)
        } finally {
          // @ts-expect-error jsdom has no scrollIntoView
          delete HTMLElement.prototype.scrollIntoView
        }
      })

      it('lets a whole-screen stop reach the safe area, not under the status bar', () => {
        const SAFE_TOP = 47
        const computed = window.getComputedStyle
        const probe = vi
          .spyOn(window, 'getComputedStyle')
          .mockImplementation((el, pseudo) => {
            if (!el.hasAttribute('data-scroll-drawer-safe-area-probe')) {
              return computed(el, pseudo)
            }
            return { paddingTop: `${SAFE_TOP}px` } as CSSStyleDeclaration
          })
        try {
          const ref = createRef<DrawerRef>()
          renderDrawer({ snapPoints: [300, 'screen'] }, ref)
          settleAt(VIEWPORT)
          probe.mockClear()
          keyboard(KEYBOARD)
          expect(sheetMax()).toBe(`${VIEWPORT - KEYBOARD - SAFE_TOP}px`)
          // Laid out bottom-up in the shrunk scroller, so its top lands here.
          expect(VIEWPORT - KEYBOARD - Number.parseFloat(sheetMax())).toBe(
            SAFE_TOP,
          )
          keyboard(KEYBOARD + 20)
          const probes = probe.mock.calls.filter(([el]) =>
            el.hasAttribute('data-scroll-drawer-safe-area-probe'),
          )
          expect(probes).toHaveLength(1)
          expect(
            document.querySelector('[data-scroll-drawer-safe-area-probe]'),
          ).toBeNull()
          settleAt(scroller().scrollTop)
          expect(ref.current?.getActiveSnapPoint()).toBe('screen')
          keyboard(0)
          expect(scroller().scrollTop).toBe(VIEWPORT)
        } finally {
          probe.mockRestore()
        }
      })
    })

    describe('when the keyboard is already up as the drawer mounts', () => {
      beforeEach(() => {
        vv.height = VIEWPORT - KEYBOARD
        vi.useRealTimers()
      })
      const settle = (top: number) => {
        const el = scroller()
        el.scrollTop = top
        fireEvent.scroll(el)
        fireEvent(el, new Event('scrollend'))
      }

      it('rides above it from the first frame', async () => {
        const ref = createRef<DrawerRef>()
        const onViewportChange = vi.fn()
        renderDrawer({ snapPoints: [300, 700], onViewportChange }, ref)
        const el = scroller()
        expect(el).toHaveAttribute('data-scroll-drawer-keyboard')
        expect(
          el.style.getPropertyValue('--scroll-drawer-keyboard-height'),
        ).toBe(`${VIEWPORT - KEYBOARD}px`)
        expect(onViewportChange).toHaveBeenCalledWith(
          expect.objectContaining({ isKeyboardOpen: true }),
        )
        await waitFor(() =>
          expect(scrollTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ top: VIEWPORT - TOP_INSET }),
          ),
        )
        settle(VIEWPORT - TOP_INSET)
        expect(ref.current?.getActiveSnapPoint()).toBe(700)
        vv.height = VIEWPORT
        act(() => {
          vv.dispatchEvent(new Event('resize'))
        })
        expect(el.scrollTop).toBe(700)
      })

      it('lets onViewportChange pick the stop the sheet opens to', async () => {
        const ref = createRef<DrawerRef>()
        renderDrawer(
          {
            snapPoints: [300, 700, 'screen'],
            defaultSnapPoint: 700,
            onViewportChange: (vp) => {
              if (vp.isKeyboardOpen) ref.current?.snapTo('screen')
            },
          },
          ref,
        )
        await waitFor(() =>
          expect(scrollTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ top: VIEWPORT }),
          ),
        )
        settle(VIEWPORT)
        expect(ref.current?.getActiveSnapPoint()).toBe('screen')
      })
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

    describe('a native drag released with the keyboard up', () => {
      it('goes one stop on with a flick', () => {
        const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
        try {
          const { onOpenChange } = renderDrawer()
          settleAt(420)
          keyboard(KEYBOARD)
          const el = scroller()
          const start = el.scrollTop
          fireEvent.touchStart(el, { touches: [{ clientY: 500 }] })
          now.mockReturnValue(1050)
          el.scrollTop = start - 100
          fireEvent.scroll(el)
          fireEvent.touchEnd(el)
          // Momentum carries it past that stop before the scroll ends.
          el.scrollTop = start - 650
          fireEvent(el, new Event('scrollend'))
          expect(scrollTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ top: 200 + KEYBOARD }),
          )
          expect(onOpenChange).not.toHaveBeenCalled()
        } finally {
          now.mockRestore()
        }
      })

      /** A slow drag: 200 ms, then a pause before release, so no flick. */
      const drag = (to: number) => {
        const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
        try {
          const el = scroller()
          fireEvent.touchStart(el, { touches: [{ clientY: 500 }] })
          now.mockReturnValue(1200)
          el.scrollTop = to
          fireEvent.scroll(el)
          now.mockReturnValue(1400)
          fireEvent.touchEnd(el)
          fireEvent(el, new Event('scrollend'))
        } finally {
          now.mockRestore()
        }
      }

      it('closes below the lowest stop', () => {
        const { onOpenChange } = renderDrawer()
        settleAt(200)
        keyboard(KEYBOARD)
        drag(KEYBOARD + 50)
        expect(scrollTo).toHaveBeenLastCalledWith(
          expect.objectContaining({ top: 0 }),
        )
        settleAt(0)
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })

      it('snaps to the nearest stop between stops, lifted', () => {
        const ref = createRef<DrawerRef>()
        const onDragEnd = vi.fn()
        const { onOpenChange } = renderDrawer({ onDragEnd }, ref)
        settleAt(200)
        keyboard(KEYBOARD)
        drag(KEYBOARD + 340)
        expect(scrollTo).toHaveBeenLastCalledWith(
          expect.objectContaining({ top: 420 + KEYBOARD }),
        )
        expect(onDragEnd).not.toHaveBeenCalled()
        settleAt(420 + KEYBOARD)
        expect(ref.current?.getActiveSnapPoint()).toBe(420)
        expect(onDragEnd).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ targetSnapPoint: 420 }),
        )
        expect(onOpenChange).not.toHaveBeenCalled()
      })

      it('stays put when not dismissible, at the lowest stop', () => {
        const { onOpenChange } = renderDrawer({ dismissible: false })
        // Not dismissible, the lowest stop is scrollTop 0.
        settleAt(0)
        keyboard(KEYBOARD)
        expect(scroller().scrollTop).toBe(KEYBOARD)
        drag(KEYBOARD + 20)
        expect(scrollTo).toHaveBeenLastCalledWith(
          expect.objectContaining({ top: KEYBOARD }),
        )
        expect(onOpenChange).not.toHaveBeenCalled()
      })
    })

    describe('a drag that takes the focused field out of view', () => {
      /** The field sits this far below the sheet's top. */
      const FIELD_Y = 40
      const FIELD_H = 40
      let rects: ReturnType<typeof vi.spyOn>
      let field: HTMLInputElement

      beforeEach(() => {
        rects = vi
          .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
          .mockImplementation(function (this: HTMLElement) {
            const el = scroller()
            if (this === el) {
              return { top: 0, bottom: vv.height } as DOMRect
            }
            if (this === field) {
              // Dismissible, so the spacer above the sheet is the viewport.
              const top = VIEWPORT - el.scrollTop + FIELD_Y
              return { top, bottom: top + FIELD_H } as DOMRect
            }
            return { top: 0, bottom: 0, left: 0, width: 0 } as DOMRect
          })
      })

      afterEach(() => {
        rects.mockRestore()
      })

      const open = (
        props: Partial<DrawerProps> = {},
        ref?: React.Ref<DrawerRef>,
      ) => {
        const utils = renderDrawer({ snapPoints: [200, 420], ...props }, ref)
        field = screen.getByRole('textbox', { name: 'Search' })
        settleAt(420)
        act(() => field.focus())
        keyboard(KEYBOARD)
        // The keyboard's top is at VIEWPORT - KEYBOARD = 600.
        expect(scroller().scrollTop).toBe(420 + KEYBOARD)
        return utils
      }
      const scrollTo_ = (top: number) => {
        scroller().scrollTop = top
        fireEvent.scroll(scroller())
      }

      it('blurs the field once it goes below the keyboard, and keeps the sheet under the finger as the keyboard closes', () => {
        const onSnapPointChange = vi.fn()
        open({ onSnapPointChange })
        const blur = vi.spyOn(field, 'blur')
        const el = scroller()
        fireEvent.touchStart(el, { touches: [{ clientY: 300 }] })
        scrollTo_(600)
        scrollTo_(400)
        expect(blur).not.toHaveBeenCalled()
        scrollTo_(330)
        expect(blur).toHaveBeenCalledTimes(1)
        expect(document.activeElement).not.toBe(field)
        scrollTo_(320)
        expect(blur).toHaveBeenCalledTimes(1)

        // The keyboard animates down over a few frames.
        keyboard(KEYBOARD - 120)
        expect(el.scrollTop).toBe(320)
        keyboard(0)
        expect(el).not.toHaveAttribute('data-scroll-drawer-keyboard')
        expect(el.scrollTop).toBe(320)

        scrollTo_(300)
        scrollTo.mockClear()
        onSnapPointChange.mockClear()
        fireEvent.touchEnd(el)
        // Snapping is back on, so the browser lands it; nothing re-aims it.
        settleAt(200)
        expect(scrollTo).not.toHaveBeenCalled()
        expect(onSnapPointChange).toHaveBeenCalledWith(200, 0)
      })

      it('lands a release made before the keyboard has gone from where the sheet is', () => {
        open()
        const el = scroller()
        fireEvent.touchStart(el, { touches: [{ clientY: 300 }] })
        scrollTo_(330)
        expect(document.activeElement).not.toBe(field)
        fireEvent.touchEnd(el)
        scrollTo.mockClear()
        fireEvent(el, new Event('scrollend'))
        expect(scrollTo).not.toHaveBeenCalled()

        // Snapping comes back with the keyboard gone; it lands from where it
        // is, not from where the stale lift would put it.
        keyboard(0)
        expect(scrollTo).toHaveBeenLastCalledWith(
          expect.objectContaining({ top: 420 }),
        )
        settleAt(420)
        expect(scroller().scrollTop).toBe(420)
      })

      it('closes a sheet released to the bottom without waiting for the keyboard', () => {
        const { onOpenChange } = open()
        const el = scroller()
        fireEvent.touchStart(el, { touches: [{ clientY: 300 }] })
        scrollTo_(300)
        fireEvent.touchEnd(el)
        scrollTo_(0)
        fireEvent(el, new Event('scrollend'))
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })

      it('blurs a field dragged above the visible area too', () => {
        open()
        const el = scroller()
        fireEvent.touchStart(el, { touches: [{ clientY: 300 }] })
        // Field bottom: VIEWPORT - scrollTop + FIELD_Y + FIELD_H.
        scrollTo_(979)
        expect(document.activeElement).toBe(field)
        scrollTo_(980)
        expect(document.activeElement).not.toBe(field)
      })

      it('leaves the field alone while it stays visible', () => {
        open()
        const blur = vi.spyOn(field, 'blur')
        const el = scroller()
        fireEvent.touchStart(el, { touches: [{ clientY: 300 }] })
        scrollTo_(600)
        scrollTo_(380)
        fireEvent.touchEnd(el)
        expect(blur).not.toHaveBeenCalled()
        expect(document.activeElement).toBe(field)
      })

      it('picks the stop from where the sheet is when a pointer drag closed the keyboard', () => {
        const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
        try {
          open()
          const el = scroller()
          const mouse = { pointerType: 'mouse', button: 0, pointerId: 1 }
          fireEvent.pointerDown(screen.getByRole('dialog'), {
            ...mouse,
            clientX: 100,
            clientY: 100,
          })
          // Past the slop: this one anchors the drag.
          fireEvent.pointerMove(window, {
            ...mouse,
            clientX: 100,
            clientY: 110,
          })
          now.mockReturnValue(1100)
          fireEvent.pointerMove(window, {
            ...mouse,
            clientX: 100,
            clientY: 500,
          })
          fireEvent.scroll(el)
          expect(el.scrollTop).toBe(330)
          expect(document.activeElement).not.toBe(field)

          keyboard(0)
          expect(el.scrollTop).toBe(330)
          now.mockReturnValue(1400)
          fireEvent.pointerUp(window, { ...mouse, clientX: 100, clientY: 500 })
          expect(scrollTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ top: 420 }),
          )
          vi.advanceTimersByTime(1)
        } finally {
          now.mockRestore()
        }
      })

      it('never blurs for scrolls it did not get from a drag', () => {
        const ref = createRef<DrawerRef>()
        open({}, ref)
        const blur = vi.spyOn(field, 'blur')
        const el = scroller()
        act(() => ref.current?.snapTo(200))
        scrollTo_(250)
        // Released: momentum and re-aims aren't the finger.
        fireEvent.touchStart(el, { touches: [{ clientY: 300 }] })
        scrollTo_(600)
        fireEvent.touchEnd(el)
        scrollTo_(200)
        expect(blur).not.toHaveBeenCalled()
      })
    })

    it('picks the stop to lay out for from the resting top while the keyboard is up', () => {
      const restore = stubSheetBox(700)
      try {
        renderDrawer({ snapPoints: [200, 420, 700] })
        settleAt(200)
        keyboard(KEYBOARD)
        const el = scroller()
        expect(el.scrollTop).toBe(200 + KEYBOARD)
        fireEvent.touchStart(el, { touches: [{ clientY: 500 }] })
        // Resting 210, so 420 is next; raw scrollTop would say 700.
        el.scrollTop = 210 + KEYBOARD
        fireEvent.scroll(el)
        // 420 lifts by the whole keyboard; the scroller is the visual viewport.
        expect(hidden()).toBe(
          `${VIEWPORT + 700 - (420 + KEYBOARD) - (VIEWPORT - KEYBOARD)}px`,
        )
        // Closing mid-drag keeps scrollTop, so the lift becomes position and
        // the sheet is past 420.
        keyboard(0)
        expect(el.scrollTop).toBe(210 + KEYBOARD)
        expect(hidden()).toBe('0px')
      } finally {
        restore()
      }
    })

    it('watches the content for the default auto stop', () => {
      renderDrawer({ snapPoints: undefined })
      const content = document.querySelector('[data-drawer-content]')
      expect(content).not.toBeNull()
      expect(observed).toContain(content)
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

    it('stays open when its auto stop measures nothing for a while', () => {
      let listHeight = 300
      const scrollHeight = vi
        .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
        .mockImplementation(function (this: HTMLElement) {
          return this.hasAttribute('data-drawer-scroll') ? listHeight : 0
        })
      try {
        const { onOpenChange } = renderDrawer({ snapPoints: ['auto'] })
        settleAt(300)
        // A Suspense fallback with no height replaces the content.
        listHeight = 0
        resize()
        expect(screen.getByRole('dialog').style.height).toBe('0px')
        settleAt(0)
        expect(onOpenChange).not.toHaveBeenCalled()
        listHeight = 300
        resize()
        expect(scroller().scrollTop).toBe(300)
      } finally {
        scrollHeight.mockRestore()
      }
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

  describe('iOS keyboard with innerHeight shrunk and the page panned', () => {
    // Search drawer frames from an iPhone (iOS 18.7) session log:
    // [visualViewport height, offsetTop, pageTop], [scrollY, innerHeight].
    const FRAMES = {
      t49242: { vv: [695, 0, 0], win: [0, 695], st: 599 },
      t51512: { vv: [392, 303, 303], win: [303, 392], rectTop: -303 },
      t126738: { vv: [695, 0, 0], win: [0, 695], st: 599 },
      t127949: { vv: [392, 303, 303], win: [303, 392], rectTop: -303 },
    } as const
    const LAYOUT = 695
    let vv: EventTarget & { height: number; offsetTop: number }

    const apply = (frame: {
      vv: readonly number[]
      win: readonly number[]
    }) => {
      vv.height = frame.vv[0] ?? 0
      vv.offsetTop = frame.vv[1] ?? 0
      vi.stubGlobal('innerHeight', frame.win[1])
      act(() => {
        vv.dispatchEvent(new Event('resize'))
      })
    }

    beforeEach(() => {
      vv = Object.assign(new EventTarget(), { height: LAYOUT, offsetTop: 0 })
      vi.stubGlobal('visualViewport', vv)
      vi.stubGlobal('innerHeight', LAYOUT)
      vi.stubGlobal('innerWidth', 393)
      vi.stubGlobal('navigator', { ...navigator, maxTouchPoints: 5 })
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get(this: HTMLElement) {
          if (!this.hasAttribute('data-scroll-drawer')) return 0
          return this.hasAttribute('data-scroll-drawer-keyboard')
            ? vv.height
            : LAYOUT
        },
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it.each([
      ['t49242', 't51512'],
      ['t126738', 't127949'],
    ] as const)('follows the keyboard from %s to %s', (rest, up) => {
      const onViewportChange = vi.fn()
      renderDrawer({ snapPoints: ['full'], onViewportChange })
      const el = scroller()
      settleAt(FRAMES[rest].st)
      expect(el.scrollTop).toBe(LAYOUT - TOP_INSET)
      act(() => screen.getByRole('textbox', { name: 'Search' }).focus())

      apply(FRAMES[up])
      expect(onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isKeyboardOpen: true, offsetTop: 303 }),
      )
      expect(el).toHaveAttribute('data-scroll-drawer-keyboard')
      // Fixed boxes sat at rect top -303, which is -offsetTop: the visual
      // viewport panned within the layout one (pageTop - offsetTop = 0), so
      // offsetTop alone puts the scroller on screen.
      expect(FRAMES[up].rectTop).toBe(-FRAMES[up].vv[1])
      expect(el.style.getPropertyValue('--scroll-drawer-keyboard-top')).toBe(
        '303px',
      )
      expect(el.style.getPropertyValue('--scroll-drawer-keyboard-height')).toBe(
        '392px',
      )
      const sheetMax = Number.parseFloat(
        el.style.getPropertyValue('--scroll-drawer-keyboard-sheet-max'),
      )
      // Laid out bottom-up in the 392px scroller: the header stays at the inset.
      expect(392 - sheetMax).toBe(TOP_INSET)

      apply(FRAMES[rest])
      expect(el).not.toHaveAttribute('data-scroll-drawer-keyboard')
      expect(el.scrollTop).toBe(LAYOUT - TOP_INSET)
    })
  })

  describe('without scrollend', () => {
    let scrollEnd: PropertyDescriptor | undefined

    beforeEach(() => {
      scrollEnd = Object.getOwnPropertyDescriptor(window, 'onscrollend')
      delete (window as { onscrollend?: unknown }).onscrollend
    })

    afterEach(() => {
      if (scrollEnd) Object.defineProperty(window, 'onscrollend', scrollEnd)
    })

    const scrollTo_ = (top: number) => {
      scroller().scrollTop = top
      fireEvent.scroll(scroller())
    }

    it('waits for the finger to lift before settling', () => {
      const onSnapPointChange = vi.fn()
      const onDragEnd = vi.fn()
      renderDrawer({ onSnapPointChange, onDragEnd })
      scrollTo_(200)
      vi.advanceTimersByTime(200)
      onSnapPointChange.mockClear()
      const el = scroller()
      fireEvent.touchStart(el, { touches: [{ clientY: 500 }] })
      scrollTo_(330)
      // Held still past the fallback.
      vi.advanceTimersByTime(500)
      expect(onSnapPointChange).not.toHaveBeenCalled()
      expect(onDragEnd).not.toHaveBeenCalled()
      scrollTo_(420)
      vi.advanceTimersByTime(500)
      expect(onSnapPointChange).not.toHaveBeenCalled()

      // Lifted on the stop, so no scroll follows the release.
      fireEvent.touchEnd(el)
      vi.advanceTimersByTime(200)
      expect(onSnapPointChange).toHaveBeenCalledWith(420, 1)
      expect(onDragEnd).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ targetSnapPoint: 420 }),
      )
    })

    it('settles a scroll that ends after the release', () => {
      const onSnapPointChange = vi.fn()
      renderDrawer({ onSnapPointChange })
      scrollTo_(420)
      vi.advanceTimersByTime(200)
      onSnapPointChange.mockClear()
      const el = scroller()
      fireEvent.touchStart(el, { touches: [{ clientY: 500 }] })
      scrollTo_(350)
      fireEvent.touchEnd(el)
      scrollTo_(260)
      scrollTo_(200)
      vi.advanceTimersByTime(200)
      expect(onSnapPointChange).toHaveBeenCalledTimes(1)
      expect(onSnapPointChange).toHaveBeenCalledWith(200, 0)
    })
  })

  describe('content layout during a drag', () => {
    const STOPS = [200, 420, 700]
    /** What's below the screen with the sheet at `top`. */
    const at = (top: number) => `${700 - top}px`
    let restore: () => void

    beforeEach(() => {
      restore = stubSheetBox(700)
    })

    afterEach(() => {
      restore()
    })

    const scrollTo_ = (top: number) => {
      scroller().scrollTop = top
      fireEvent.scroll(scroller())
    }
    const hiddenWrites = () => vi.spyOn(scroller().style, 'setProperty')
    const writesOf = (spy: ReturnType<typeof hiddenWrites>) =>
      spy.mock.calls.filter(([name]) => name === '--scroll-drawer-hidden')
        .length

    it('lays out for the next stop up as a drag leaves the lowest, and again past each stop', () => {
      renderDrawer({ snapPoints: STOPS })
      settleAt(200)
      expect(hidden()).toBe(at(200))
      const writes = hiddenWrites()
      const el = scroller()
      fireEvent.touchStart(el, { touches: [{ clientY: 500 }] })
      scrollTo_(210)
      expect(hidden()).toBe(at(420))
      scrollTo_(300)
      scrollTo_(419)
      expect(hidden()).toBe(at(420))
      expect(writesOf(writes)).toBe(1)
      scrollTo_(430)
      expect(hidden()).toBe(at(700))
      // Overscroll past the top stop keeps the top layout.
      scrollTo_(760)
      expect(hidden()).toBe(at(700))
      expect(writesOf(writes)).toBe(2)
    })

    it('keeps the higher layout dragging down until it passes below a stop', () => {
      renderDrawer({ snapPoints: STOPS })
      settleAt(700)
      expect(hidden()).toBe(at(700))
      const el = scroller()
      fireEvent.touchStart(el, { touches: [{ clientY: 100 }] })
      scrollTo_(690)
      scrollTo_(430)
      expect(hidden()).toBe(at(700))
      scrollTo_(410)
      expect(hidden()).toBe(at(420))
      scrollTo_(150)
      expect(hidden()).toBe(at(200))
    })

    it('returns to the resting layout once released and settled', () => {
      renderDrawer({ snapPoints: STOPS })
      settleAt(200)
      const el = scroller()
      fireEvent.touchStart(el, { touches: [{ clientY: 500 }] })
      scrollTo_(300)
      fireEvent.touchEnd(el)
      // Momentum isn't the finger.
      scrollTo_(250)
      expect(hidden()).toBe(at(420))
      settleAt(200)
      expect(hidden()).toBe(at(200))
    })

    it('leaves a programmatic snap at the resting layout until it settles', () => {
      const ref = createRef<DrawerRef>()
      renderDrawer({ snapPoints: STOPS }, ref)
      settleAt(200)
      act(() => ref.current?.snapTo(700))
      scrollTo_(400)
      scrollTo_(600)
      expect(hidden()).toBe(at(200))
      settleAt(700)
      expect(hidden()).toBe(at(700))
    })

    it('does the same for a pointer drag', () => {
      renderDrawer({ snapPoints: STOPS })
      settleAt(200)
      const el = scroller()
      const mouse = { pointerType: 'mouse', button: 0, pointerId: 1 }
      const sheet = screen.getByRole('dialog')
      fireEvent.pointerDown(sheet, { ...mouse, clientX: 100, clientY: 500 })
      // Past the slop: this one anchors the drag.
      fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 510 })
      expect(hidden()).toBe(at(200))
      fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 490 })
      expect(el.scrollTop).toBe(220)
      expect(hidden()).toBe(at(420))
      fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 200 })
      expect(hidden()).toBe(at(700))
      fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 400 })
      expect(el.scrollTop).toBe(310)
      expect(hidden()).toBe(at(420))
      fireEvent.pointerUp(window, { ...mouse, clientX: 100, clientY: 400 })
      expect(hidden()).toBe(at(420))
      settleAt(200)
      expect(hidden()).toBe(at(200))
      vi.advanceTimersByTime(1)
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

  describe('handleOnly with native touch', () => {
    const touch = (y: number, x = 100) => [
      { identifier: 1, clientX: x, clientY: y },
    ]
    /** False when the drawer canceled the pan. */
    const pan = (target: Element, dy: number, dx = 0) => {
      fireEvent.touchStart(target, { touches: touch(300) })
      return fireEvent.touchMove(target, { touches: touch(300 + dy, 100 + dx) })
    }

    it('keeps a pan on the list or other content from moving the sheet', () => {
      renderDrawer({ handleOnly: true })
      const list = document.querySelector('[data-drawer-scroll]')
      const handle = document.querySelector('[data-drawer-handle]')
      if (!list || !handle) throw new Error('parts missing')
      expect(pan(list, -40)).toBe(false)
      expect(pan(list, 40)).toBe(false)
      expect(pan(handle, 40)).toBe(true)
      // Sideways: whatever scrolls horizontally there.
      expect(pan(list, 5, 40)).toBe(true)
    })

    it('lets an unlocked list scroll itself', () => {
      const scrollHeight = vi
        .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
        .mockReturnValue(2000)
      try {
        renderDrawer({ handleOnly: true, contentScroll: 'always' })
        const list = document.querySelector<HTMLElement>('[data-drawer-scroll]')
        if (!list) throw new Error('list missing')
        expect(pan(list, -40)).toBe(true)
        // At its top, a pull down would chain to the sheet.
        expect(pan(list, 40)).toBe(false)
        list.scrollTop = 100
        expect(pan(list, 40)).toBe(true)
      } finally {
        scrollHeight.mockRestore()
      }
    })

    it('leaves native touch alone without handleOnly', () => {
      renderDrawer()
      const list = document.querySelector('[data-drawer-scroll]')
      if (!list) throw new Error('list missing')
      expect(pan(list, 40)).toBe(true)
    })
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
