'use client'

import { createFocusTrap } from 'focus-trap'
import type React from 'react'
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  DRAWER_DRAG_SLOP_PX,
  DRAWER_TOP_INSET_PX,
  VELOCITY_THRESHOLD,
} from '../../constants'
import { DrawerSlotsProvider, useDrawerSlots } from '../../drawerSlotsContext'
import {
  measureIntrinsicAutoHeight,
  resolveSnapPointsToHeights,
  resolveSnapValueToPx,
} from '../../hooks/useDrawerSnap'
import { useVisualViewport } from '../../hooks/useVisualViewport'
import type {
  DragInfo,
  DrawerProps,
  DrawerRef,
  SnapPoint,
  ViewportInfo,
} from '../../types'
import {
  cn,
  EDITABLE_SELECTOR,
  editableTargetHasContent,
  lockBody,
  unlockBody,
} from '../../utils'
import { DrawerHandle } from '../drawer/DrawerHandle'
import { DrawerOverlay } from '../drawer/DrawerOverlay'
import {
  type BackdropRange,
  nearestIndex,
  supportsScrollTimeline,
  writeBackdropOpacity,
} from './geometry'
import { type Layer, openLayer } from './layers'
import { joinStack } from './stack'
import { injectScrollDrawerStyles } from './styles'

const DEFAULT_SNAP_POINTS: readonly SnapPoint[] = ['auto']
const SETTLE_FALLBACK_MS = 120
const CLOSE_FALLBACK_MS = 700
const CONTROL_SELECTOR = 'button, a'
const NEVER_DRAG_SELECTOR = `${EDITABLE_SELECTOR}, select, [data-drawer-no-drag]`
const EDGE_PX = 1
// A finger jitters more than a mouse; under this a touch is still a tap.
const TOUCH_SLOP_PX = 8
const VELOCITY_WINDOW_MS = 100

/**
 * Snap points resolved to pixel heights for the viewport the drawer opened
 * in. Recomputed when the scroller resizes (rotation, browser chrome), not
 * when the software keyboard opens, so typing never moves the stops.
 */
type Stops = {
  heights: number[]
  raw: SnapPoint[]
  /** Scroller height the stops were resolved against. */
  viewport: number
  /** Px of the lowest stop at `scrollTop` 0: 0 when dismissible. */
  offset: number
}

type DragSession = {
  event: MouseEvent | TouchEvent | PointerEvent
  started: boolean
  ended: boolean
  startTop: number
  samples: { t: number; top: number }[]
  /** Frozen at release, so `onDragEnd` reports the flick, not the settle. */
  /** `lift`: the keyboard lift in effect at release. */
  release?: { y: number; velocity: number; lift: number }
  /** Its release already picked a stop to scroll to. */
  aimed?: boolean
  /** It hid the focused field, which was blurred to close the keyboard. */
  blurred?: boolean
}

function startSession(event: DragSession['event'], top: number): DragSession {
  return {
    event,
    started: false,
    ended: false,
    startTop: top,
    samples: [{ t: performance.now(), top }],
  }
}

function recordSample(session: DragSession, top: number) {
  const t = performance.now()
  const { samples } = session
  samples.push({ t, top })
  while (samples.length > 2 && t - (samples[0]?.t ?? t) > VELOCITY_WINDOW_MS) {
    samples.shift()
  }
}

/**
 * Px/s over the last {@link VELOCITY_WINDOW_MS}, positive while the sheet
 * moves down. A pause before release reads 0.
 */
function sessionVelocity(session: DragSession, now: number): number {
  const recent = session.samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS)
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (!first || !last || last.t <= first.t) return 0
  return ((first.top - last.top) / (last.t - first.t)) * 1000
}

/**
 * A flick goes one stop in its direction; anything slower to the nearest.
 * With `from`, where a sequential drag began, a flick lands at most one stop
 * from there, as `scroll-snap-stop: always` does natively.
 */
function releaseTarget(
  top: number,
  velocity: number,
  pos: number[],
  from?: number,
): number {
  if (Math.abs(velocity) >= VELOCITY_THRESHOLD) {
    const ahead =
      velocity < 0
        ? pos.find((p) => p > top + EDGE_PX)
        : pos.filter((p) => p < top - EDGE_PX).pop()
    if (ahead !== undefined && from !== undefined) {
      const start = nearestIndex(from, pos)
      const i = pos.indexOf(ahead)
      return pos[Math.min(start + 1, Math.max(start - 1, i))] ?? ahead
    }
    if (ahead !== undefined) return ahead
  }
  return pos[nearestIndex(top, pos)] ?? 0
}

function endSession(
  session: DragSession,
  event: DragSession['event'],
  top: number,
  lift: number,
) {
  session.event = event
  session.release = {
    y: session.startTop - top,
    velocity: sessionVelocity(session, performance.now()),
    lift,
  }
}

type Ctx = { registerContent: (el: HTMLElement | null) => void }
const ScrollEngineContext = createContext<Ctx | null>(null)

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** env() isn't readable from script; a probe's computed padding resolves it. */
function safeAreaTop(): number {
  const probe = document.createElement('div')
  probe.setAttribute('data-scroll-drawer-safe-area-probe', '')
  probe.style.cssText =
    'position:fixed;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top, 0px)'
  document.body.appendChild(probe)
  const px = Number.parseFloat(getComputedStyle(probe).paddingTop)
  probe.remove()
  return Number.isFinite(px) ? px : 0
}

function scrollToTop(el: HTMLElement, top: number, instant = false) {
  const behavior: ScrollBehavior =
    instant || prefersReducedMotion() ? 'instant' : 'smooth'
  if (typeof el.scrollTo === 'function') el.scrollTo({ top, behavior })
  else el.scrollTop = top
}

const EXIT_TIMING: KeyframeAnimationOptions = {
  duration: 240,
  easing: 'cubic-bezier(0.32, 0, 0.67, 0)',
  fill: 'forwards',
}

// Ease-out and a little longer than the slide: an ease-in fade holds the dim,
// then drops it all at once as the sheet leaves.
const FADE_TIMING: KeyframeAnimationOptions = {
  duration: 320,
  easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  fill: 'forwards',
}

/**
 * A non-dismissible sheet has no closed scroll position to scroll to, so it
 * exits by translating the scroller while the backdrop, a sibling outside it,
 * only fades. Returns a cancel.
 */
function slideOut(
  el: HTMLElement,
  backdrop: HTMLElement | null,
  done: () => void,
): () => void {
  const sheet = el.querySelector<HTMLElement>('[data-scroll-drawer-sheet]')
  if (!sheet || typeof el.animate !== 'function') {
    done()
    return () => {}
  }
  const distance = Math.max(
    0,
    el.clientHeight - sheet.getBoundingClientRect().top,
  )
  const exit = el.animate(
    [{ translate: '0 0' }, { translate: `0 ${distance}px` }],
    EXIT_TIMING,
  )
  const fade = backdrop?.animate(
    [{ opacity: getComputedStyle(backdrop).opacity }, { opacity: 0 }],
    FADE_TIMING,
  )
  let finished = false
  Promise.all([exit.finished, fade?.finished]).then(
    () => {
      finished = true
      done()
    },
    () => {},
  )
  return () => {
    if (finished) return
    exit.cancel()
    fade?.cancel()
  }
}

/**
 * Scroll range over which a stack drawer covers the ones behind it: closed to
 * its lowest stop. A pinned drawer has no closed position, so it's empty.
 */
function coverRange(stops: Stops | null): { start: number; end: number } {
  if (!stops || stops.offset > 0) return { start: 0, end: 0 }
  return { start: 0, end: stops.heights[0] ?? 0 }
}

function sameStops(a: Stops | null, b: Stops): boolean {
  return (
    !!a &&
    a.viewport === b.viewport &&
    a.offset === b.offset &&
    a.heights.length === b.heights.length &&
    a.heights.every((h, i) => h === b.heights[i]) &&
    a.raw.length === b.raw.length &&
    a.raw.every((r, i) => r === b.raw[i])
  )
}

function positionsOf(stops: Stops): number[] {
  return stops.heights.map((h) => Math.max(0, h - stops.offset))
}

function backdropRange(stops: Stops, fadeFromIndex?: number): BackdropRange {
  const pos = positionsOf(stops)
  if (fadeFromIndex === undefined) {
    return { start: 0, end: pos[0] ?? 0, min: 0, max: 1 }
  }
  const i = Math.max(0, Math.min(fadeFromIndex, pos.length - 1))
  return {
    start: i > 0 ? (pos[i - 1] ?? 0) : 0,
    end: pos[i] ?? 0,
    min: 0,
    max: 1,
  }
}

const DrawerRoot = forwardRef<DrawerRef, DrawerProps>(
  function DrawerRoot(props, ref) {
    const {
      open: controlledOpen,
      defaultOpen,
      snapPoints = DEFAULT_SNAP_POINTS,
      activeSnapPoint,
      dismissible = true,
      modal = true,
      focusTrap = true,
      handleOnly = false,
      fadeFromIndex,
      snapToSequentialPoint = false,
      ariaLabel,
      title,
      description,
      topInsetPx = DRAWER_TOP_INSET_PX,
      bottomInsetPx = 0,
      safeAreaBottom = true,
      children,
      overlayClassName,
      slots,
      contentScroll = 'top',
      stack = false,
    } = props

    const isControlled = controlledOpen !== undefined
    const [uncontrolledOpen, setUncontrolledOpen] = useState(
      () => defaultOpen ?? false,
    )
    const open = isControlled ? controlledOpen : uncontrolledOpen
    const [mounted, setMounted] = useState(open)
    const [stops, setStops] = useState<Stops | null>(null)

    const scrollerRef = useRef<HTMLDivElement>(null)
    const sheetRef = useRef<HTMLDivElement>(null)
    const backdropRef = useRef<HTMLDivElement>(null)
    const keyboardFillRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLElement | null>(null)
    const closingRef = useRef(false)
    const openedRef = useRef(false)
    // Chrome fires a scrollend at 0 for the reset before the opening scroll
    // starts; without this the sheet reads that as a swipe-to-dismiss.
    const armedRef = useRef(false)
    const lastIndexRef = useRef<number | null>(null)
    /** The stop the opening scroll heads for, until that scroll starts. */
    const entryIndexRef = useRef<number | null>(null)
    /**
     * The stop index a programmatic scroll is heading for, -1 for closed;
     * null once it settles or a drag takes over.
     */
    const aimRef = useRef<number | null>(null)
    /** `settle`, for `scrollToIndex`, which `settle` itself depends on. */
    const settleRef = useRef<(() => void) | null>(null)
    /** The opening frame and animations; `frame` is 0 once it has run. */
    const entryRef = useRef<{
      frame: number
      animations: (Animation | null)[]
    } | null>(null)
    /** Set while a JS-driven drag (mouse, or touch on a modeless sheet) writes scrollTop. */
    const draggingRef = useRef(false)
    /** Ends a mouse drag's window listeners early. */
    const mouseDragRef = useRef<(() => void) | null>(null)
    /** The stop content is laid out for during a drag; null at rest. */
    const aheadRef = useRef<number | null>(null)
    const sessionRef = useRef<DragSession | null>(null)
    /**
     * Set while the software keyboard is up; `lift` is the scrollTop added.
     * `pending`: it came up while the sheet was still entering, so the lift
     * waits for the entry to settle.
     */
    const keyboardRef = useRef<{
      inset: number
      lift: number
      pending: boolean
      /** `env(safe-area-inset-top)` in px, read once per keyboard. */
      safeTop: number | null
      /** The scroller's box while the keyboard is up, read on first need. */
      bounds: { top: number; bottom: number } | null
    } | null>(null)
    const stopsRef = useRef<Stops | null>(null)
    const titleId = useId()
    const stackName = `--scroll-drawer-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
    const stackRef = useRef<ReturnType<typeof joinStack> | null>(null)
    const joinStackRef = useRef<(() => void) | null>(null)
    const [stacked, setStacked] = useState(false)

    useEffect(() => {
      const el = scrollerRef.current
      if (!mounted || !stack || !el) return
      const join = () => {
        stackRef.current = joinStack({
          name: stackName,
          scroller: el,
          range: coverRange(stopsRef.current),
          onDepth: (depth) => setStacked(depth > 0),
        })
      }
      joinStackRef.current = join
      join()
      return () => {
        stackRef.current?.leave()
        stackRef.current = null
        joinStackRef.current = null
        setStacked(false)
      }
    }, [mounted, stack, stackName])

    useEffect(() => {
      if (!stops) return
      stackRef.current?.update(coverRange(stops))
    }, [stops])
    const descriptionId = useId()

    const latest = useRef(props)
    // Committed values only, so a render React discards can't reach handlers.
    // An insertion effect runs before every layout effect and ref callback,
    // children's included.
    useInsertionEffect(() => {
      latest.current = props
      stopsRef.current = stops
    })
    const openRef = useRef(open)
    openRef.current = open

    const setOpen = useCallback(
      (next: boolean) => {
        if (!isControlled) setUncontrolledOpen(next)
        latest.current.onOpenChange?.(next)
      },
      [isControlled],
    )

    if (open && !mounted) setMounted(true)

    const wasOpenRef = useRef(open)
    useEffect(() => {
      if (wasOpenRef.current && !open) latest.current.onClose?.()
      wasOpenRef.current = open
    }, [open])

    const resolveStops = useCallback((viewportPx?: number): Stops | null => {
      const el = scrollerRef.current
      if (!el) return null
      const p = latest.current
      const points = p.snapPoints ?? DEFAULT_SNAP_POINTS
      const viewport = viewportPx ?? el.clientHeight
      const available = Math.max(
        0,
        viewport - (p.topInsetPx ?? DRAWER_TOP_INSET_PX),
      )
      let auto: number | null = null
      if (points.includes('auto')) {
        const sheet = sheetRef.current
        const content = contentRef.current
        if (content) auto = measureIntrinsicAutoHeight(content)
        else if (sheet) {
          auto = 0
          for (const child of sheet.children) {
            if (
              child instanceof HTMLElement &&
              !child.hasAttribute('data-scroll-drawer-markers')
            ) {
              auto += child.offsetHeight
            }
          }
        }
        if (sheet && auto !== null) {
          const cs = getComputedStyle(sheet)
          auto +=
            (Number.parseFloat(cs.paddingTop) || 0) +
            (Number.parseFloat(cs.paddingBottom) || 0)
        }
      }
      const { heights, rawValues } = resolveSnapPointsToHeights(
        points,
        available,
        auto,
        0,
        viewport,
      )
      const pinned = !(p.dismissible ?? true)
      return {
        heights,
        raw: rawValues,
        viewport,
        offset: pinned ? (heights[0] ?? 0) : 0,
      }
    }, [])

    const pxOfPoint = useCallback((point: SnapPoint, s: Stops): number => {
      const p = latest.current
      return resolveSnapValueToPx(
        point,
        Math.max(0, s.viewport - (p.topInsetPx ?? DRAWER_TOP_INSET_PX)),
        s.heights[s.heights.length - 1],
        0,
        s.viewport,
      )
    }, [])

    const indexOfPoint = useCallback(
      (point: SnapPoint): number => {
        const s = stopsRef.current
        if (!s || s.heights.length === 0) return -1
        const exact = s.raw.indexOf(point)
        if (exact !== -1) return exact
        return nearestIndex(pxOfPoint(point, s), s.heights)
      },
      [pxOfPoint],
    )

    /** A finger or pointer is moving the sheet right now. */
    const dragActive = useCallback((): boolean => {
      const session = sessionRef.current
      return (
        draggingRef.current || (!!session && session.started && !session.ended)
      )
    }, [])

    // As iOS's keyboardDismissMode: a drag that takes the field out of view
    // closes the keyboard, rather than leaving it to notice much later.
    const blurHiddenField = useCallback(
      (el: HTMLElement, session: DragSession) => {
        const kb = keyboardRef.current
        const sheet = sheetRef.current
        const field = document.activeElement
        if (!kb || kb.pending || !sheet || !(field instanceof HTMLElement)) {
          return
        }
        if (field === sheet || !sheet.contains(field)) return
        // The scroller spans the visual viewport while the keyboard is up.
        // Its rect, not visualViewport numbers, because iOS reports rects
        // against the visual viewport once it pans.
        if (!kb.bounds) {
          const box = el.getBoundingClientRect()
          kb.bounds = { top: box.top, bottom: box.bottom }
        }
        const r = field.getBoundingClientRect()
        if (r.top >= kb.bounds.bottom || r.bottom <= kb.bounds.top) {
          session.blurred = true
          field.blur()
        }
      },
      [],
    )

    /** scrollTop as if the keyboard were down: what stops are measured in. */
    const restingTop = useCallback((el: HTMLElement): number => {
      return el.scrollTop - (keyboardRef.current?.lift ?? 0)
    }, [])

    /**
     * The highest the sheet's top may go while the keyboard is up. A 'screen'
     * stop may reach the top, but not under the status bar: with the keyboard
     * up the sheet holds a field and its header, not full-bleed content.
     */
    const keyboardMinTop = useCallback((): number => {
      const p = latest.current
      if (!(p.snapPoints ?? DEFAULT_SNAP_POINTS).includes('screen')) {
        return p.topInsetPx ?? DRAWER_TOP_INSET_PX
      }
      const kb = keyboardRef.current
      if (!kb) return safeAreaTop()
      if (kb.safeTop === null) kb.safeTop = safeAreaTop()
      return kb.safeTop
    }, [])

    /**
     * Raises a sheet at `top` by the keyboard height, so whatever was visible
     * stays visible, but never past `keyboardMinTop`: the scroller has shrunk
     * to the visual viewport and a taller sheet is laid out shorter instead.
     */
    const liftAt = useCallback(
      (top: number): number => {
        const kb = keyboardRef.current
        const s = stopsRef.current
        if (!kb || !s) return 0
        const room = s.viewport - s.offset - top - keyboardMinTop()
        return Math.max(0, Math.min(kb.inset, room))
      },
      [keyboardMinTop],
    )

    const physicalTop = useCallback(
      (top: number): number => {
        const kb = keyboardRef.current
        if (!kb) return top
        kb.lift = liftAt(top)
        return top + kb.lift
      },
      [liftAt],
    )

    const writeHidden = useCallback((el: HTMLElement, top: number) => {
      const sheet = sheetRef.current
      if (!sheet) return
      // Layout offsets, not getBoundingClientRect: the pinned entry translate
      // may still be running and would inflate the hidden height.
      const hidden =
        sheet.offsetTop + sheet.offsetHeight - top - el.clientHeight
      el.style.setProperty(
        '--scroll-drawer-hidden',
        `${Math.max(0, Math.round(hidden))}px`,
      )
    }, [])

    const layoutHidden = useCallback(
      (el: HTMLElement) => {
        aheadRef.current = null
        writeHidden(el, el.scrollTop)
      },
      [writeHidden],
    )

    // Laid out for the resting stop, a sheet dragged up would reveal only the
    // empty fill strip until it settles; lay out for the stop it's heading
    // into instead, and only when it crosses one.
    const layoutAhead = useCallback(
      (el: HTMLElement) => {
        const s = stopsRef.current
        if (!s) return
        const pos = positionsOf(s)
        const top = restingTop(el)
        const found = pos.findIndex((p) => p >= top - EDGE_PX)
        const index = found === -1 ? pos.length - 1 : found
        if (index === aheadRef.current) return
        aheadRef.current = index
        const stop = pos[index] ?? 0
        writeHidden(el, stop + (keyboardRef.current ? liftAt(stop) : 0))
      },
      [restingTop, liftAt, writeHidden],
    )

    const visibleHeight = useCallback((): number => {
      const el = scrollerRef.current
      const s = stopsRef.current
      if (!el || !s) return 0
      const max = s.heights[s.heights.length - 1] ?? 0
      return Math.max(0, Math.min(max, restingTop(el) + s.offset))
    }, [restingTop])

    const dragInfo = useCallback(
      (session: DragSession | null): DragInfo => {
        const el = scrollerRef.current
        const s = stopsRef.current
        const pos = s ? positionsOf(s) : []
        const max = pos[pos.length - 1] ?? 0
        const live = () => ({
          y: session && el ? session.startTop - el.scrollTop : 0,
          velocity: session ? sessionVelocity(session, performance.now()) : 0,
        })
        return {
          ...(session?.release ?? live()),
          progress: el && max > 0 ? Math.min(1, restingTop(el) / max) : 1,
        }
      },
      [restingTop],
    )

    const scrollToIndex = useCallback(
      (index: number, instant = false) => {
        const el = scrollerRef.current
        const s = stopsRef.current
        if (!el || !s) return
        const top = positionsOf(s)[index]
        if (top === undefined) return
        // A snap asked for before the opening scroll starts would be undone by it.
        if (entryIndexRef.current !== null) entryIndexRef.current = index
        const target = physicalTop(top)
        const aim = aimRef.current
        if (aim === index) return
        // No scroll would follow to settle it and pair the callbacks; a
        // parent echoing the stop it was just told about lands here. A scroll
        // still heading elsewhere would carry it off, so stop that one here.
        if (Math.abs(el.scrollTop - target) <= EDGE_PX) {
          if (aim !== null) {
            scrollToTop(el, target, true)
            settleRef.current?.()
          }
          return
        }
        latest.current.onAnimationStart?.(
          visibleHeight(),
          s.heights[index] ?? 0,
        )
        aimRef.current = index
        scrollToTop(el, target, instant)
      },
      [physicalTop, visibleHeight],
    )

    const targetIndex = useCallback((): number => {
      const s = stopsRef.current
      if (!s) return 0
      const p = latest.current
      const wanted = p.activeSnapPoint ?? p.defaultSnapPoint
      const i = wanted === undefined ? -1 : indexOfPoint(wanted)
      return i === -1 ? s.heights.length - 1 : i
    }, [indexOfPoint])

    const settle = useCallback(() => {
      const el = scrollerRef.current
      const s = stopsRef.current
      if (!el || !s || draggingRef.current) return
      aimRef.current = null
      const p = latest.current
      if (closingRef.current) {
        if (el.scrollTop <= EDGE_PX) setMounted(false)
        return
      }
      const kb = keyboardRef.current
      const session = sessionRef.current
      if (kb && session?.ended && session.blurred) {
        // It blurred the field and the keyboard is on its way down; unless
        // it's closing, landing it waits for that, once the lift is gone.
        if (!((p.dismissible ?? true) && el.scrollTop <= EDGE_PX)) return
      } else if (kb && !kb.pending && session?.ended && !session.aimed) {
        // Snapping is off while the keyboard is up, so a native drag would
        // rest wherever momentum left it; aim it as the JS drag does.
        session.aimed = true
        const dismissible = p.dismissible ?? true
        const stopsAt = dismissible ? [0, ...positionsOf(s)] : positionsOf(s)
        const released = session.startTop - (session.release?.y ?? 0)
        const lift = session.release?.lift ?? kb.lift
        const top = releaseTarget(
          released - lift,
          session.release?.velocity ?? 0,
          stopsAt,
          p.snapToSequentialPoint ? session.startTop - lift : undefined,
        )
        const physical = dismissible && top === 0 ? 0 : physicalTop(top)
        if (Math.abs(el.scrollTop - physical) > EDGE_PX) {
          scrollToTop(el, physical)
          return
        }
      }
      // An 'auto' stop with nothing to measure resolves to 0 (content
      // unmounted, a Suspense fallback); that's the sheet at rest, not a swipe.
      const emptyStop = (positionsOf(s)[0] ?? 0) <= EDGE_PX
      if ((p.dismissible ?? true) && el.scrollTop <= EDGE_PX && !emptyStop) {
        if (!armedRef.current) return
        sessionRef.current = null
        setOpen(false)
        // A controlled parent may keep it open (a "discard changes?" veto);
        // off screen, the scroller would still cover the page.
        setTimeout(() => {
          if (openRef.current && !closingRef.current) scrollToIndex(0)
        })
        return
      }
      const pos = positionsOf(s)
      const index = nearestIndex(restingTop(el), pos)
      if (kb?.pending) {
        kb.pending = false
        const lifted = physicalTop(pos[index] ?? 0)
        if (Math.abs(el.scrollTop - lifted) > EDGE_PX) {
          scrollToTop(el, lifted)
          return
        }
      }
      const from = p.contentScrollFrom
      const unlockAt = from === undefined ? pos.length - 1 : indexOfPoint(from)
      el.toggleAttribute(
        'data-scroll-drawer-full',
        unlockAt !== -1 && index >= unlockAt,
      )
      layoutHidden(el)
      if (s.raw.length === 0) {
        sessionRef.current = null
        return
      }
      const raw = s.raw[index] as SnapPoint
      if (session?.ended) {
        sessionRef.current = null
        if (session.started) {
          p.onDragEnd?.(session.event, {
            ...dragInfo(session),
            targetSnapPoint: raw,
          })
        }
      }
      if (index !== lastIndexRef.current) {
        lastIndexRef.current = index
        // A parent driving `activeSnapPoint` already knows, even when the
        // stop kept is an equivalent value ('full' for 1); echoing it back
        // invites feedback loops.
        const want = p.activeSnapPoint
        const known =
          want !== undefined &&
          (raw === want || pxOfPoint(want, s) === s.heights[index])
        if (!known) p.onSnapPointChange?.(raw, index)
      }
      p.onAnimationComplete?.(raw)
      p.onHeightChange?.(visibleHeight())
    }, [
      dragInfo,
      indexOfPoint,
      layoutHidden,
      physicalTop,
      pxOfPoint,
      restingTop,
      scrollToIndex,
      setOpen,
      visibleHeight,
    ])

    useInsertionEffect(() => {
      settleRef.current = settle
    })

    // iOS draws the keyboard and its accessory bar translucent; native sheets
    // keep their surface behind them, so the page mustn't show through where
    // the shortened scroller ends. Read once per keyboard, not per frame.
    const paintKeyboardFill = useCallback((fill: HTMLElement) => {
      const sheet = sheetRef.current
      if (!sheet) return
      const surface =
        contentRef.current ??
        sheet.querySelector<HTMLElement>('[data-drawer-content]') ??
        sheet
      const css = getComputedStyle(surface)
      fill.style.background =
        css.getPropertyValue('--scroll-drawer-fill').trim() ||
        css.backgroundColor
      const rect = sheet.getBoundingClientRect()
      fill.style.left = `${rect.left}px`
      fill.style.width = `${rect.width}px`
    }, [])

    // Stops stay put while the keyboard is up (it isn't a new screen size);
    // instead the scroller shrinks to the visual viewport and the sheet rides
    // up with it, docked above the keyboard.
    const followKeyboard = useCallback(
      (vp: ViewportInfo) => {
        const el = scrollerRef.current
        const s = stopsRef.current
        if (!el || !s || !openedRef.current || closingRef.current) return
        const inset = vp.isKeyboardOpen
          ? Math.max(0, Math.round(s.viewport - vp.height))
          : 0
        const kb = keyboardRef.current
        if (!inset) {
          if (!kb) return
          const top = restingTop(el)
          keyboardRef.current = null
          const session = sessionRef.current
          // A drag that closed the keyboard keeps its scrollTop, so the sheet
          // stays under the finger: the scroller's top stays at the screen's
          // and the lift just becomes part of the position. Otherwise this
          // lands before the height comes back, which would clamp the lifted
          // top.
          const dragged = dragActive() || !!session?.blurred
          const aim = aimRef.current
          if (!dragged && aim !== null) {
            scrollToTop(el, aim === -1 ? 0 : (positionsOf(s)[aim] ?? top))
          } else if (!dragged) {
            el.scrollTop =
              positionsOf(s)[nearestIndex(top, positionsOf(s))] ?? top
          }
          el.removeAttribute('data-scroll-drawer-keyboard')
          el.style.removeProperty('--scroll-drawer-keyboard-top')
          el.style.removeProperty('--scroll-drawer-keyboard-height')
          el.style.removeProperty('--scroll-drawer-keyboard-sheet-max')
          layoutHidden(el)
          if (dragActive()) layoutAhead(el)
          // Released while snapping was still off: land it from here.
          if (session?.blurred && session.ended && !dragActive()) {
            const pos = positionsOf(s)
            const land = releaseTarget(
              el.scrollTop,
              0,
              (latest.current.dismissible ?? true) ? [0, ...pos] : pos,
            )
            // Already there, no scroll would end to settle it.
            if (Math.abs(el.scrollTop - land) <= EDGE_PX) settle()
            else scrollToTop(el, land)
          }
          return
        }
        const top = restingTop(el)
        // An instant scrollTop write here would cut the entry scroll short,
        // and a lift measured at the entry's start would be stale by its end.
        const entering = lastIndexRef.current === null
        keyboardRef.current = {
          inset,
          lift: kb?.lift ?? 0,
          pending: kb ? kb.pending : entering,
          safeTop: kb?.safeTop ?? null,
          bounds: null,
        }
        el.setAttribute('data-scroll-drawer-keyboard', '')
        // The scroller is shorter by the keyboard, which would add as much
        // scroll range above the cap; iOS uses it to reveal a focused field
        // and pushes the sheet's top off screen. A sheet no taller than the
        // room below the cap leaves no range past it, on any scroll path.
        el.style.setProperty(
          '--scroll-drawer-keyboard-sheet-max',
          `${Math.max(0, vp.height - keyboardMinTop())}px`,
        )
        el.style.setProperty(
          '--scroll-drawer-keyboard-top',
          `${vp.offsetTop}px`,
        )
        el.style.setProperty(
          '--scroll-drawer-keyboard-height',
          `${vp.height}px`,
        )
        if (!keyboardRef.current.pending && !dragActive()) {
          // Writing scrollTop would cut a snap still scrolling short, and
          // snapping is off to finish it; re-aim it at the new lift instead.
          const aim = aimRef.current
          if (aim !== null) {
            scrollToTop(
              el,
              aim === -1 ? 0 : physicalTop(positionsOf(s)[aim] ?? 0),
            )
          } else el.scrollTop = physicalTop(top)
        }
        layoutHidden(el)
        if (dragActive()) layoutAhead(el)
        const fill = keyboardFillRef.current
        if (fill) fill.style.top = `${vp.offsetTop + vp.height}px`
        if (kb) return
        if (fill) paintKeyboardFill(fill)
        if (entering) return
        // Focus scrolled the field into view against the full-height layout;
        // the lower part of the sheet may since have moved behind the keyboard.
        const active = document.activeElement
        if (
          active instanceof HTMLElement &&
          active !== sheetRef.current &&
          sheetRef.current?.contains(active) &&
          typeof active.scrollIntoView === 'function'
        ) {
          active.scrollIntoView({ block: 'nearest' })
        }
      },
      [
        dragActive,
        keyboardMinTop,
        layoutAhead,
        layoutHidden,
        paintKeyboardFill,
        physicalTop,
        restingTop,
        settle,
      ],
    )

    useVisualViewport({
      // Not before the stops: the hook reports the current viewport once when
      // enabled, and a keyboard already up then (focus handed over from the
      // opener) sends no further event to follow.
      enabled: mounted && stops !== null,
      onViewportChange: (vp) => {
        followKeyboard(vp)
        latest.current.onViewportChange?.(vp)
      },
    })

    useImperativeHandle(
      ref,
      () => ({
        snapTo: (point) => {
          const i = indexOfPoint(point)
          if (i !== -1) scrollToIndex(i)
        },
        expand: () => {
          const s = stopsRef.current
          if (s) scrollToIndex(s.heights.length - 1)
        },
        collapse: () => scrollToIndex(0),
        dismiss: () => setOpen(false),
        getActiveSnapPoint: () => {
          const s = stopsRef.current
          const i = lastIndexRef.current
          return s && i !== null && !closingRef.current
            ? (s.raw[i] ?? null)
            : null
        },
        getHeight: visibleHeight,
      }),
      [indexOfPoint, scrollToIndex, setOpen, visibleHeight],
    )

    // Resolve on mount; a synchronous re-render lands the stops before paint.
    useLayoutEffect(() => {
      if (!mounted) {
        openedRef.current = false
        keyboardRef.current = null
        setStops(null)
        return
      }
      injectScrollDrawerStyles()
      const next = resolveStops()
      if (next) setStops(next)
    }, [mounted, resolveStops])

    /** The resting layout for a stop the sheet hasn't reached yet. */
    const layoutFor = (el: HTMLElement, s: Stops, index: number) => {
      const sheetH = s.heights[s.heights.length - 1] ?? 0
      el.style.setProperty(
        '--scroll-drawer-hidden',
        `${Math.max(0, sheetH - (s.heights[index] ?? 0))}px`,
      )
    }

    const pointsKey = (snapPoints ?? DEFAULT_SNAP_POINTS).join('|')
    useLayoutEffect(() => {
      if (!mounted || !openedRef.current) return
      // The keyboard shortens the scroller; stops stay against the screen.
      const next = resolveStops(
        keyboardRef.current ? stopsRef.current?.viewport : undefined,
      )
      if (next && !sameStops(stopsRef.current, next)) setStops(next)
    }, [mounted, pointsKey, dismissible, topInsetPx, resolveStops])

    const shownStopsRef = useRef<Stops | null>(null)
    useLayoutEffect(() => {
      const el = scrollerRef.current
      if (!stops || !el) return
      const prev = shownStopsRef.current
      shownStopsRef.current = stops
      if (openedRef.current) {
        if (closingRef.current) return
        if (lastIndexRef.current === null && entryRef.current) {
          // Content that lands mid-entry (data replacing a skeleton) moves the
          // target, and the entry carries on to it rather than jumping there.
          const aim = aimRef.current
          const kept =
            entryIndexRef.current ?? (aim !== null && aim >= 0 ? aim : null)
          const index =
            kept !== null && kept < stops.heights.length ? kept : targetIndex()
          if (entryIndexRef.current !== null) entryIndexRef.current = index
          const top = positionsOf(stops)[index] ?? 0
          layoutFor(el, stops, index)
          if (!(latest.current.dismissible ?? true)) el.scrollTop = top
          else if (!entryRef.current.frame) {
            aimRef.current = index
            scrollToTop(el, physicalTop(top))
          }
          return
        }
        // The release settles against the new stops.
        if (dragActive()) {
          layoutHidden(el)
          layoutAhead(el)
          return
        }
        // Stops moved under an open sheet: hold the same stop at its new
        // height, found by value, since 'auto' can move past a fixed stop.
        // A snap still scrolling holds the stop it's heading for.
        const aim = aimRef.current
        const held = aim !== null && aim >= 0 ? aim : lastIndexRef.current
        const heldRaw = held === null ? undefined : prev?.raw[held]
        const found = heldRaw === undefined ? -1 : stops.raw.indexOf(heldRaw)
        const i = found !== -1 ? found : (held ?? targetIndex())
        const top = positionsOf(stops)[i]
        if (aim !== null && aim >= 0 && top !== undefined) {
          aimRef.current = i
          scrollToTop(el, physicalTop(top))
          return
        }
        if (top !== undefined) el.scrollTop = physicalTop(top)
        settle()
        return
      }
      openedRef.current = true
      armedRef.current = false
      closingRef.current = false
      lastIndexRef.current = null
      // A touch still down when it last closed never saw its touchend.
      sessionRef.current = null
      aimRef.current = null
      entryIndexRef.current = targetIndex()
      const pinned = !(latest.current.dismissible ?? true)
      const target = positionsOf(stops)[targetIndex()] ?? 0
      el.scrollTop = pinned ? target : 0
      layoutFor(el, stops, targetIndex())
      // Synchronously, so chrome positioned against the sheet is right on
      // first paint rather than one frame late.
      latest.current.onHeightChange?.(visibleHeight())
      const backdropEl = backdropRef.current

      // Translating the track instead would grow the scroll area and move the
      // snap areas, and WebKit snaps the sheet fully open for the duration.
      const animateEntry =
        pinned && !prefersReducedMotion() && typeof el.animate === 'function'
      const entry = animateEntry
        ? el.animate([{ translate: '0 100%' }, { translate: '0 0' }], {
            duration: 300,
            easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
          })
        : null
      const entryFade =
        entry && backdropEl
          ? // No end keyframe: it eases into whatever the scroll timeline says,
            // which hasn't resolved yet before first layout.
            backdropEl.animate([{ opacity: 0, offset: 0 }], {
              duration: 300,
              easing: 'ease-out',
            })
          : null

      const frame = requestAnimationFrame(() => {
        if (entryRef.current) entryRef.current.frame = 0
        const index = entryIndexRef.current ?? targetIndex()
        entryIndexRef.current = null
        if (pinned) {
          settle()
          return
        }
        const now = stopsRef.current ?? stops
        latest.current.onAnimationStart?.(0, now.heights[index] ?? 0)
        const lifted = physicalTop(positionsOf(now)[index] ?? 0)
        if (keyboardRef.current) keyboardRef.current.pending = false
        aimRef.current = index
        scrollToTop(el, lifted)
        if (Math.abs(el.scrollTop - lifted) <= EDGE_PX && lifted > EDGE_PX) {
          settle()
        }
      })
      entryRef.current = { frame, animations: [entry, entryFade] }
    }, [
      stops,
      settle,
      targetIndex,
      visibleHeight,
      physicalTop,
      dragActive,
      layoutHidden,
      layoutAhead,
    ])

    useEffect(() => {
      if (!open) mouseDragRef.current?.()
    }, [open])

    useLayoutEffect(() => {
      if (!mounted) return
      return () => {
        mouseDragRef.current?.()
        const entry = entryRef.current
        entryRef.current = null
        if (!entry) return
        cancelAnimationFrame(entry.frame)
        for (const a of entry.animations) a?.cancel()
      }
    }, [mounted])

    useEffect(() => {
      const el = scrollerRef.current
      if (!mounted || !el) return
      const backdrop = supportsScrollTimeline() ? null : backdropRef.current
      const range = () => {
        const s = stopsRef.current
        const r = s
          ? backdropRange(s, latest.current.fadeFromIndex)
          : { start: 0, end: 0, min: 0, max: 1 }
        if (!backdrop) return r
        const css = getComputedStyle(backdrop)
        const read = (name: string, fallback: number) => {
          const v = Number.parseFloat(css.getPropertyValue(name))
          return Number.isNaN(v) ? fallback : v
        }
        return {
          ...r,
          min: read('--scroll-drawer-backdrop-min', 0),
          max: read('--scroll-drawer-backdrop-max', 1),
        }
      }
      if (backdrop) writeBackdropOpacity(el, backdrop, range())

      let timer: ReturnType<typeof setTimeout> | undefined
      let frame = 0
      const hasScrollEnd = 'onscrollend' in window
      // A finger held still for the timeout isn't a scroll that ended; the
      // release arms it again.
      const fallback = () => {
        const session = sessionRef.current
        if (draggingRef.current || (session && !session.ended)) return
        settle()
      }
      const armFallback = () => {
        clearTimeout(timer)
        timer = setTimeout(fallback, SETTLE_FALLBACK_MS)
      }
      const perFrame = () => {
        frame = 0
        const session = sessionRef.current
        const p = latest.current
        if (session?.started && p.onDrag)
          p.onDrag(session.event, dragInfo(session))
        p.onHeightChange?.(visibleHeight())
      }
      const onScroll = () => {
        if (el.scrollTop > EDGE_PX) armedRef.current = true
        if (backdrop) writeBackdropOpacity(el, backdrop, range())
        const session = sessionRef.current
        // A JS drag samples where it writes scrollTop; this event lands a
        // frame later and would skew the timing.
        if (session && !session.ended && !draggingRef.current) {
          recordSample(session, el.scrollTop)
        }
        if (session && !session.started) {
          session.started = true
          latest.current.onDragStart?.(session.event, dragInfo(session))
        }
        if (session && !session.ended && !session.blurred) {
          blurHiddenField(el, session)
        }
        if (dragActive()) layoutAhead(el)
        if (
          !frame &&
          (latest.current.onDrag || latest.current.onHeightChange)
        ) {
          frame = requestAnimationFrame(perFrame)
        }
        if (!hasScrollEnd) armFallback()
      }
      const onTouchStart = (e: TouchEvent) => {
        aimRef.current = null
        sessionRef.current = startSession(e, el.scrollTop)
      }
      const onTouchMove = (e: TouchEvent) => {
        if (sessionRef.current) sessionRef.current.event = e
      }
      const onTouchEnd = (e: TouchEvent) => {
        const session = sessionRef.current
        // Already ended by a modeless touch drag on the sheet.
        if (!session || session.ended) return
        endSession(session, e, el.scrollTop, keyboardRef.current?.lift ?? 0)
        if (session.started) {
          session.ended = true
          if (!hasScrollEnd) armFallback()
        } else sessionRef.current = null
      }
      const ro =
        typeof ResizeObserver === 'function'
          ? new ResizeObserver(() => {
              if (!openedRef.current || closingRef.current) return
              const current = stopsRef.current
              const typing = !!keyboardRef.current
              const next = resolveStops(typing ? current?.viewport : undefined)
              if (!next || sameStops(current, next)) return
              // Content that shrinks while the keyboard is up (a cleared
              // query) mustn't pull the field away mid-typing. It
              // re-resolves when the keyboard hides and the scroller resizes.
              const top = (h: number[]) => h[h.length - 1] ?? 0
              if (
                typing &&
                current &&
                top(next.heights) < top(current.heights)
              ) {
                return
              }
              setStops(next)
            })
          : null
      ro?.observe(el)
      if (
        contentRef.current &&
        (latest.current.snapPoints ?? DEFAULT_SNAP_POINTS).includes('auto')
      ) {
        ro?.observe(contentRef.current)
        for (const child of contentRef.current.children) ro?.observe(child)
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      el.addEventListener('touchstart', onTouchStart, { passive: true })
      el.addEventListener('touchmove', onTouchMove, { passive: true })
      el.addEventListener('touchend', onTouchEnd, { passive: true })
      el.addEventListener('touchcancel', onTouchEnd, { passive: true })
      if (hasScrollEnd) el.addEventListener('scrollend', settle)
      return () => {
        clearTimeout(timer)
        cancelAnimationFrame(frame)
        ro?.disconnect()
        el.removeEventListener('scroll', onScroll)
        el.removeEventListener('touchstart', onTouchStart)
        el.removeEventListener('touchmove', onTouchMove)
        el.removeEventListener('touchend', onTouchEnd)
        el.removeEventListener('touchcancel', onTouchEnd)
        el.removeEventListener('scrollend', settle)
      }
    }, [
      mounted,
      settle,
      dragInfo,
      visibleHeight,
      resolveStops,
      blurHiddenField,
      dragActive,
      layoutAhead,
    ])

    useEffect(() => {
      if (!mounted) return
      const el = scrollerRef.current
      if (open) {
        if (closingRef.current && el) {
          closingRef.current = false
          scrollToIndex(targetIndex())
        }
        return
      }
      if (!el || prefersReducedMotion()) {
        setMounted(false)
        return
      }
      if (!(latest.current.dismissible ?? true)) {
        // Nothing scrolls, so the drawers behind would hold their recede
        // until unmount; leave the stack now so they grow back with the slide.
        stackRef.current?.leave()
        stackRef.current = null
        let left = false
        const cancel = slideOut(el, backdropRef.current, () => {
          left = true
          setMounted(false)
        })
        return () => {
          cancel()
          if (!left && !stackRef.current) joinStackRef.current?.()
        }
      }
      if (el.scrollTop <= EDGE_PX) {
        setMounted(false)
        return
      }
      closingRef.current = true
      latest.current.onAnimationStart?.(visibleHeight(), 0)
      aimRef.current = -1
      scrollToTop(el, 0)
      const timer = setTimeout(() => setMounted(false), CLOSE_FALLBACK_MS)
      return () => clearTimeout(timer)
    }, [open, mounted, scrollToIndex, targetIndex, visibleHeight])

    const lastActiveRef = useRef(activeSnapPoint)
    useEffect(() => {
      if (activeSnapPoint === lastActiveRef.current) return
      lastActiveRef.current = activeSnapPoint
      if (!open || activeSnapPoint === undefined || !openedRef.current) return
      const i = indexOfPoint(activeSnapPoint)
      if (i !== -1) scrollToIndex(i)
    }, [activeSnapPoint, open, indexOfPoint, scrollToIndex])

    useEffect(() => {
      if (!mounted || !modal) return
      lockBody()
      return unlockBody
    }, [mounted, modal])

    // Declared before the layer effect so the trap lets go of focus before
    // that effect's cleanup hands it back.
    useEffect(() => {
      const sheet = sheetRef.current
      if (!open || !mounted || !modal || !focusTrap || !sheet) return
      const trap = createFocusTrap(sheet, {
        returnFocusOnDeactivate: false,
        fallbackFocus: sheet,
        initialFocus: sheet,
        escapeDeactivates: false,
        allowOutsideClick: true,
        clickOutsideDeactivates: false,
        // Focusing a snap area makes Chrome snap to it, skipping the open snap.
        preventScroll: true,
      })
      try {
        trap.activate()
      } catch {
        // Nothing focusable yet; the sheet itself is the fallback.
      }
      return () => {
        trap.deactivate()
      }
    }, [open, mounted, modal, focusTrap])

    const layerRef = useRef<Layer | null>(null)
    useEffect(() => {
      const sheet = sheetRef.current
      if (!open || !mounted || !sheet) return
      const opener = document.activeElement
      const layer: Layer = {
        sheet,
        modal: latest.current.modal ?? true,
        onEscape: (e) => {
          if (editableTargetHasContent(e.target)) return
          if (!(latest.current.dismissible ?? true)) return
          e.preventDefault()
          if (!closingRef.current) setOpen(false)
        },
      }
      const { leave } = openLayer(layer)
      layerRef.current = layer
      if (layer.modal && !sheet.contains(document.activeElement)) {
        // Focusing a snap area makes Chrome snap to it, skipping the open snap.
        sheet.focus({ preventScroll: true })
      }
      return () => {
        layerRef.current = null
        const below = leave()
        const active = document.activeElement
        // Focus the user has since moved elsewhere stays where it is.
        if (active && active !== document.body && !sheet.contains(active)) {
          return
        }
        if (
          opener instanceof HTMLElement &&
          opener !== document.body &&
          opener.isConnected &&
          !sheet.contains(opener)
        ) {
          opener.focus({ preventScroll: true })
        } else if (below) {
          below.sheet.focus({ preventScroll: true })
        } else if (active instanceof HTMLElement) {
          active.blur()
        }
      }
    }, [open, mounted, setOpen])

    useEffect(() => {
      if (layerRef.current) layerRef.current.modal = modal
    }, [modal])

    const requestClose = () => {
      if ((latest.current.dismissible ?? true) && !closingRef.current) {
        setOpen(false)
      }
    }

    /**
     * Drives the scroller from a pointer the browser won't scroll it for: a
     * mouse, which can't pan a scroll container, and touch on a modeless
     * sheet, whose `pointer-events: none` scroller WebKit never latches a pan
     * onto. `fromY` is where the sheet should track the pointer from.
     */
    const beginDrag = useCallback(
      (event: DragSession['event'], fromY: number) => {
        const el = scrollerRef.current
        if (!el) return null
        const anchor = { y: fromY, top: el.scrollTop }
        draggingRef.current = true
        aimRef.current = null
        const session = startSession(event, el.scrollTop)
        sessionRef.current = session
        el.style.scrollSnapType = 'none'
        el.setAttribute('data-scroll-drawer-dragging', '')
        document.getSelection()?.removeAllRanges()
        return {
          session,
          move: (ev: DragSession['event'], y: number) => {
            session.event = ev
            el.scrollTop = anchor.top - (y - anchor.y)
            recordSample(session, el.scrollTop)
            layoutAhead(el)
          },
          /** `flick` false (a canceled touch) ignores the release velocity. */
          end: (ev: DragSession['event'], flick = true) => {
            draggingRef.current = false
            el.removeAttribute('data-scroll-drawer-dragging')
            // The release would otherwise click whatever the drag ended on.
            const swallow = (ce: MouseEvent) => {
              ce.stopPropagation()
              ce.preventDefault()
            }
            window.addEventListener('click', swallow, {
              capture: true,
              once: true,
            })
            setTimeout(() => window.removeEventListener('click', swallow, true))
            endSession(
              session,
              ev,
              el.scrollTop,
              keyboardRef.current?.lift ?? 0,
            )
            session.aimed = true
            if (sessionRef.current === session) {
              if (session.started) session.ended = true
              else sessionRef.current = null
            }
            const s = stopsRef.current
            el.style.scrollSnapType = ''
            if (!s) return
            const dismissible = latest.current.dismissible ?? true
            const pos = dismissible ? [0, ...positionsOf(s)] : positionsOf(s)
            const velocity = flick ? (session.release?.velocity ?? 0) : 0
            const lift = keyboardRef.current?.lift ?? 0
            const top = releaseTarget(
              restingTop(el),
              velocity,
              pos,
              latest.current.snapToSequentialPoint
                ? session.startTop - lift
                : undefined,
            )
            // Closed is physical 0 whatever the lift, as on the native path.
            const closing = dismissible && top === 0
            const there = closing
              ? el.scrollTop <= EDGE_PX
              : Math.abs(restingTop(el) - top) <= EDGE_PX
            if (there) settle()
            else scrollToTop(el, closing ? 0 : physicalTop(top))
          },
        }
      },
      [layoutAhead, physicalTop, restingTop, settle],
    )

    // Not from controls or `[data-drawer-no-drag]`, not from
    // a list that is scrolled, and only past the slop so a click still clicks.
    const onSheetPointerDown = useCallback(
      (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return
        if (!(e.target instanceof Element)) return
        // React bubbles through portals: a drawer opened from this one would
        // otherwise drag both.
        if (!e.currentTarget.contains(e.target)) return
        const target = e.target
        if (target.closest(NEVER_DRAG_SELECTOR)) return
        const control = target.closest(CONTROL_SELECTOR)
        // `data-drawer-drag` opts controls in: the slop keeps a tap a tap, and the
        // click a drag ends on is swallowed.
        if (control && !control.closest('[data-drawer-drag]')) return
        if (
          latest.current.handleOnly &&
          !target.closest('[data-drawer-handle]')
        ) {
          return
        }
        const list = target.closest<HTMLElement>('[data-drawer-scroll]')
        if (list && list.scrollTop > 0) return

        const id = e.pointerId
        const downX = e.clientX
        const downY = e.clientY
        let drag: ReturnType<typeof beginDrag> = null
        const stop = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', end)
          window.removeEventListener('pointercancel', end)
          if (mouseDragRef.current === abandon) mouseDragRef.current = null
        }
        // Closed or unmounted with the button still held.
        const abandon = () => {
          stop()
          if (!drag) return
          draggingRef.current = false
          if (sessionRef.current === drag.session) sessionRef.current = null
          const el = scrollerRef.current
          el?.removeAttribute('data-scroll-drawer-dragging')
          if (el) el.style.scrollSnapType = ''
        }
        mouseDragRef.current?.()
        mouseDragRef.current = abandon
        const move = (ev: PointerEvent) => {
          if (ev.pointerId !== id) return
          if (!drag) {
            const dx = Math.abs(ev.clientX - downX)
            const dy = Math.abs(ev.clientY - downY)
            if (Math.max(dx, dy) < DRAWER_DRAG_SLOP_PX) return
            // Mostly sideways: leave it to whatever scrolls horizontally here.
            if (dx > dy) return stop()
            drag = beginDrag(ev, ev.clientY)
            if (!drag) return stop()
          }
          ev.preventDefault()
          drag.move(ev, ev.clientY)
        }
        const end = (ev: PointerEvent) => {
          if (ev.pointerId !== id) return
          stop()
          drag?.end(ev)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', end)
        window.addEventListener('pointercancel', end)
      },
      [beginDrag],
    )

    /** Whether the list under the finger scrolls this way by itself. */
    const listScrolls = useCallback((target: Element, down: boolean) => {
      const list = target.closest<HTMLElement>('[data-drawer-scroll]')
      if (!list || !sheetRef.current?.contains(list)) return false
      const unlocked =
        latest.current.contentScroll === 'always' ||
        !!scrollerRef.current?.hasAttribute('data-scroll-drawer-full')
      if (!unlocked || down) return list.scrollTop > 0
      return list.scrollTop + list.clientHeight < list.scrollHeight - EDGE_PX
    }, [])

    // Unlike the mouse, a touch drags from buttons and links too: past the
    // slop it was never a tap, and a pill-like control is often the only part
    // of a collapsed modeless sheet there is to grab.
    useEffect(() => {
      const sheet = sheetRef.current
      if (!mounted || modal || !sheet) return
      let gesture: {
        id: number
        x: number
        y: number
        target: Element
        drag: ReturnType<typeof beginDrag>
      } | null = null

      const touchOf = (e: TouchEvent) => {
        if (!gesture) return null
        for (const t of e.changedTouches) {
          if (t.identifier === gesture.id) return t
        }
        return null
      }

      const onStart = (e: TouchEvent) => {
        if (gesture?.drag) return
        gesture = null
        const t = e.touches.length === 1 ? e.touches[0] : undefined
        const target = e.target
        if (!t || !(target instanceof Element) || !sheet.contains(target)) {
          return
        }
        if (target.closest(NEVER_DRAG_SELECTOR)) return
        if (
          latest.current.handleOnly &&
          !target.closest('[data-drawer-handle]')
        ) {
          return
        }
        gesture = {
          id: t.identifier,
          x: t.clientX,
          y: t.clientY,
          target,
          drag: null,
        }
      }
      const onMove = (e: TouchEvent) => {
        const t = touchOf(e)
        if (!gesture || !t) return
        if (!gesture.drag) {
          const dx = Math.abs(t.clientX - gesture.x)
          const dy = t.clientY - gesture.y
          if (Math.max(dx, Math.abs(dy)) < TOUCH_SLOP_PX) return
          // Sideways, a list that scrolls this way, or a pan the browser
          // already started (uncancelable): native.
          if (
            dx > Math.abs(dy) ||
            !e.cancelable ||
            listScrolls(gesture.target, dy > 0)
          ) {
            gesture = null
            return
          }
          gesture.drag = beginDrag(e, gesture.y)
          if (!gesture.drag) {
            gesture = null
            return
          }
        }
        e.preventDefault()
        gesture.drag.move(e, t.clientY)
      }
      const onEnd = (e: TouchEvent) => {
        if (!touchOf(e)) return
        const drag = gesture?.drag
        gesture = null
        drag?.end(e, e.type === 'touchend')
      }

      sheet.addEventListener('touchstart', onStart, { passive: true })
      sheet.addEventListener('touchmove', onMove, { passive: false })
      sheet.addEventListener('touchend', onEnd)
      sheet.addEventListener('touchcancel', onEnd)
      return () => {
        sheet.removeEventListener('touchstart', onStart)
        sheet.removeEventListener('touchmove', onMove)
        sheet.removeEventListener('touchend', onEnd)
        sheet.removeEventListener('touchcancel', onEnd)
        if (gesture?.drag) draggingRef.current = false
      }
    }, [mounted, modal, beginDrag, listScrolls])

    // `touch-action` can't stop a list's pan from chaining to the scroller,
    // nor reach content outside `Drawer.Content`, so the browser's own pan
    // of the sheet is canceled here unless it starts on the handle.
    useEffect(() => {
      const sheet = sheetRef.current
      if (!mounted || !handleOnly || !sheet) return
      let start = { x: 0, y: 0 }
      const onStart = (e: TouchEvent) => {
        const t = e.touches[0]
        start = { x: t?.clientX ?? 0, y: t?.clientY ?? 0 }
      }
      const onMove = (e: TouchEvent) => {
        const target = e.target
        const t = e.touches[0]
        if (!e.cancelable || !t || !(target instanceof Element)) return
        if (target.closest('[data-drawer-handle]')) return
        const dy = t.clientY - start.y
        if (Math.abs(t.clientX - start.x) > Math.abs(dy)) return
        if (listScrolls(target, dy > 0)) return
        e.preventDefault()
      }
      sheet.addEventListener('touchstart', onStart, { passive: true })
      sheet.addEventListener('touchmove', onMove, { passive: false })
      return () => {
        sheet.removeEventListener('touchstart', onStart)
        sheet.removeEventListener('touchmove', onMove)
      }
    }, [mounted, handleOnly, listScrolls])

    const registerContent = useCallback((el: HTMLElement | null) => {
      contentRef.current = el
    }, [])

    if (!mounted || typeof document === 'undefined') return null

    const pinned = !dismissible
    const offset = stops?.offset ?? 0
    const sheetHeight = stops
      ? stops.heights[stops.heights.length - 1]
      : undefined
    const range = stops ? backdropRange(stops, fadeFromIndex) : null
    const safeAreaPadding =
      safeAreaBottom === false
        ? undefined
        : typeof safeAreaBottom === 'number'
          ? `${safeAreaBottom}px`
          : 'env(safe-area-inset-bottom, 0px)'

    return createPortal(
      <ScrollEngineContext.Provider value={{ registerContent }}>
        <div
          data-scroll-drawer-root=""
          data-scroll-drawer-pinned={pinned ? '' : undefined}
          data-scroll-drawer-stacked={stacked ? '' : undefined}
        >
          {/* Outside the scroller so the scroller's exit and entry translates never move it. */}
          {modal ? (
            <div
              ref={backdropRef}
              data-scroll-drawer-backdrop=""
              data-scroll-drawer-backdrop-static={
                range && range.end <= range.start ? '' : undefined
              }
              className={overlayClassName}
              style={
                range
                  ? ({
                      '--scroll-drawer-fade-start': `${range.start}px`,
                      '--scroll-drawer-fade-end': `${range.end}px`,
                    } as React.CSSProperties)
                  : undefined
              }
              aria-hidden
            />
          ) : null}
          <div
            ref={scrollerRef}
            data-scroll-drawer=""
            data-scroll-drawer-dismissible={dismissible ? '' : undefined}
            data-scroll-drawer-modeless={modal ? undefined : ''}
            data-scroll-drawer-sequential={
              snapToSequentialPoint ? '' : undefined
            }
            data-scroll-drawer-handle-only={handleOnly ? '' : undefined}
            data-scroll-drawer-content-scroll={contentScroll}
            style={
              {
                '--scroll-drawer-bottom-inset': `${bottomInsetPx}px`,
                '--scroll-drawer-vh': stops ? `${stops.viewport}px` : undefined,
                ...(stack
                  ? {
                      scrollTimelineName: `--scroll-drawer, ${stackName}`,
                      scrollTimelineAxis: 'y, y',
                      transformOrigin: '50% 0',
                    }
                  : null),
              } as React.CSSProperties
            }
          >
            <div data-scroll-drawer-track="">
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                data-scroll-drawer-spacer=""
                style={{
                  height: stops
                    ? `${Math.max(0, stops.viewport - offset)}px`
                    : '100%',
                }}
                onClick={requestClose}
              />
              <div
                ref={sheetRef}
                role="dialog"
                aria-modal={modal}
                aria-label={title == null ? ariaLabel : undefined}
                aria-labelledby={title == null ? undefined : titleId}
                aria-describedby={
                  description != null ? descriptionId : undefined
                }
                tabIndex={-1}
                data-scroll-drawer-sheet=""
                style={{
                  height:
                    sheetHeight === undefined ? undefined : `${sheetHeight}px`,
                  paddingBottom: safeAreaPadding,
                }}
                onPointerDown={onSheetPointerDown}
              >
                <div
                  data-scroll-drawer-markers=""
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                  }}
                >
                  {stops?.heights.slice(0, -1).map((h) => (
                    <div
                      key={h}
                      data-scroll-drawer-marker={h}
                      style={{ ['--scroll-drawer-snap' as string]: `${h}px` }}
                    />
                  ))}
                </div>
                <DrawerSlotsProvider value={slots ?? {}}>
                  {title != null ? (
                    <div id={titleId} className="sr-only">
                      {title}
                    </div>
                  ) : null}
                  {description != null ? (
                    <div id={descriptionId} className="sr-only">
                      {description}
                    </div>
                  ) : null}
                  {children}
                </DrawerSlotsProvider>
              </div>
            </div>
          </div>
          <div
            ref={keyboardFillRef}
            data-scroll-drawer-keyboard-fill=""
            aria-hidden
          />
        </div>
      </ScrollEngineContext.Provider>,
      document.body,
    )
  },
)

DrawerRoot.displayName = 'Drawer'

export type DrawerContentProps = React.HTMLAttributes<HTMLDivElement>

/** The sheet's surface. Its children are what `'auto'` measures. */
export const DrawerContent = forwardRef<HTMLDivElement, DrawerContentProps>(
  function DrawerContent({ className, ...rest }, forwardedRef) {
    const ctx = useContext(ScrollEngineContext)
    const slots = useDrawerSlots()
    const setRefs = useCallback(
      (el: HTMLDivElement | null) => {
        ctx?.registerContent(el)
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef) forwardedRef.current = el
      },
      [ctx, forwardedRef],
    )
    return (
      <div
        ref={setRefs}
        data-drawer-content=""
        className={cn(
          'flex min-h-0 flex-1 flex-col rounded-t-3xl',
          slots.contentClassName,
          className,
        )}
        {...rest}
      />
    )
  },
)

export type DrawerScrollableProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Also receives the scrolling element, alongside the forwarded `ref`. */
  externalRef?: React.RefObject<HTMLElement | null>
}

/**
 * The sheet's inner scroller. With `contentScroll="top"` it is locked until
 * the sheet reaches its top stop (or `contentScrollFrom`), then scrolls and chains back to the sheet at
 * its top; with `"always"` it scrolls at every stop.
 */
export const DrawerScrollable = forwardRef<
  HTMLDivElement,
  DrawerScrollableProps
>(function DrawerScrollable({ className, externalRef, ...rest }, forwardedRef) {
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      if (externalRef && 'current' in externalRef) {
        ;(externalRef as React.MutableRefObject<HTMLElement | null>).current =
          el
      }
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) forwardedRef.current = el
    },
    [externalRef, forwardedRef],
  )
  return (
    <div
      ref={setRefs}
      data-drawer-scroll=""
      data-scroll-drawer-scrollable=""
      className={cn('min-h-0 flex-1', className)}
      {...rest}
    />
  )
})

/**
 * A bottom sheet whose track is a native scroll-snap container, so a swipe
 * runs on the compositor instead of a JavaScript animation loop.
 *
 * Touch drags the sheet from anywhere except `[data-drawer-no-drag]`, and on
 * a modeless sheet not from fields either.
 * A mouse drags it from anywhere except buttons and links, unless they sit
 * inside `[data-drawer-drag]`, and never from fields or `[data-drawer-no-drag]`.
 */
export const Drawer = Object.assign(DrawerRoot, {
  Content: DrawerContent,
  Scrollable: DrawerScrollable,
  Handle: DrawerHandle,
  /** @deprecated Renders nothing; the backdrop is built in. */
  Overlay: DrawerOverlay,
})
