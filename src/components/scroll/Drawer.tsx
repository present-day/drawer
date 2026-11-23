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
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { DRAWER_DRAG_SLOP_PX, DRAWER_TOP_INSET_PX } from '../../constants'
import { DrawerSlotsProvider, useDrawerSlots } from '../../drawerSlotsContext'
import {
  measureIntrinsicAutoHeight,
  resolveSnapPointsToHeights,
  resolveSnapValueToPx,
} from '../../hooks/useDrawerSnap'
import { useVisualViewport } from '../../hooks/useVisualViewport'
import type { DragInfo, DrawerProps, DrawerRef, SnapPoint } from '../../types'
import { cn, editableTargetHasContent, lockBody, unlockBody } from '../../utils'
import { DrawerHandle } from '../drawer/DrawerHandle'
import { DrawerOverlay } from '../drawer/DrawerOverlay'
import {
  type BackdropRange,
  nearestIndex,
  supportsScrollTimeline,
  writeBackdropOpacity,
} from './geometry'
import { joinStack } from './stack'
import { injectScrollDrawerStyles } from './styles'

const DEFAULT_SNAP_POINTS: readonly SnapPoint[] = ['auto']
const SETTLE_FALLBACK_MS = 120
const CLOSE_FALLBACK_MS = 700
const CONTROL_SELECTOR = 'button, a'
const NEVER_DRAG_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [data-drawer-no-drag]'
const EDGE_PX = 1
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
  samples: { t: number; top: number }[]
  /** Frozen at release, so `onDragEnd` reports the flick, not the settle. */
  releaseVelocity?: number
}

function startSession(event: DragSession['event'], top: number): DragSession {
  return {
    event,
    started: false,
    ended: false,
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
 * moves down, matching v2's pointer velocity. A pause before release reads 0.
 */
function sessionVelocity(session: DragSession, now: number): number {
  const recent = session.samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS)
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (!first || !last || last.t <= first.t) return 0
  return ((first.top - last.top) / (last.t - first.t)) * 1000
}

function endSession(session: DragSession, event: DragSession['event']) {
  session.event = event
  session.releaseVelocity = sessionVelocity(session, performance.now())
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
    a.heights.every((h, i) => h === b.heights[i])
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
      contentScroll = 'full',
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
    const contentRef = useRef<HTMLElement | null>(null)
    const closingRef = useRef(false)
    const openedRef = useRef(false)
    // Chrome fires a scrollend at 0 for the reset before the opening scroll
    // starts; without this the sheet reads that as a swipe-to-dismiss.
    const armedRef = useRef(false)
    const lastIndexRef = useRef<number | null>(null)
    const mouseDragRef = useRef<{ id: number; y: number; top: number } | null>(
      null,
    )
    const sessionRef = useRef<DragSession | null>(null)
    const stopsRef = useRef<Stops | null>(null)
    stopsRef.current = stops
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
    latest.current = props

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

    useVisualViewport({
      enabled: mounted,
      onViewportChange: (vp) => {
        scrollerRef.current?.style.setProperty(
          '--visual-viewport-height',
          `${vp.height}px`,
        )
        latest.current.onViewportChange?.(vp)
      },
    })

    const resolveStops = useCallback((): Stops | null => {
      const el = scrollerRef.current
      if (!el) return null
      const p = latest.current
      const points = p.snapPoints ?? DEFAULT_SNAP_POINTS
      const viewport = el.clientHeight
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

    const indexOfPoint = useCallback((point: SnapPoint): number => {
      const s = stopsRef.current
      if (!s || s.heights.length === 0) return -1
      const exact = s.raw.indexOf(point)
      if (exact !== -1) return exact
      const p = latest.current
      const px = resolveSnapValueToPx(
        point,
        Math.max(0, s.viewport - (p.topInsetPx ?? DRAWER_TOP_INSET_PX)),
        s.heights[s.heights.length - 1],
        0,
        s.viewport,
      )
      return nearestIndex(px, s.heights)
    }, [])

    const visibleHeight = useCallback((): number => {
      const el = scrollerRef.current
      const s = stopsRef.current
      if (!el || !s) return 0
      const max = s.heights[s.heights.length - 1] ?? 0
      return Math.max(0, Math.min(max, el.scrollTop + s.offset))
    }, [])

    const dragInfo = useCallback(
      (session: DragSession | null): DragInfo => {
        const el = scrollerRef.current
        const s = stopsRef.current
        const pos = s ? positionsOf(s) : []
        const max = pos[pos.length - 1] ?? 0
        const velocity = !session
          ? 0
          : (session.releaseVelocity ??
            sessionVelocity(session, performance.now()))
        return {
          y: visibleHeight(),
          velocity,
          progress: el && max > 0 ? Math.min(1, el.scrollTop / max) : 1,
        }
      },
      [visibleHeight],
    )

    const scrollToIndex = useCallback(
      (index: number, instant = false) => {
        const el = scrollerRef.current
        const s = stopsRef.current
        if (!el || !s) return
        const top = positionsOf(s)[index]
        if (top === undefined) return
        latest.current.onAnimationStart?.(
          visibleHeight(),
          s.heights[index] ?? 0,
        )
        scrollToTop(el, top, instant)
      },
      [visibleHeight],
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
      if (!el || !s || mouseDragRef.current) return
      const p = latest.current
      if (closingRef.current) {
        if (el.scrollTop <= EDGE_PX) setMounted(false)
        return
      }
      if ((p.dismissible ?? true) && el.scrollTop <= EDGE_PX) {
        if (!armedRef.current) return
        sessionRef.current = null
        setOpen(false)
        return
      }
      const pos = positionsOf(s)
      const index = nearestIndex(el.scrollTop, pos)
      const from = p.contentScrollFrom
      const unlockAt = from === undefined ? pos.length - 1 : indexOfPoint(from)
      el.toggleAttribute(
        'data-scroll-drawer-full',
        unlockAt !== -1 && index >= unlockAt,
      )
      const sheet = sheetRef.current
      if (sheet) {
        // Layout offsets, not getBoundingClientRect: the pinned entry translate
        // may still be running and would inflate the hidden height.
        const hidden =
          sheet.offsetTop + sheet.offsetHeight - el.scrollTop - el.clientHeight
        el.style.setProperty(
          '--scroll-drawer-hidden',
          `${Math.max(0, Math.round(hidden))}px`,
        )
      }
      const raw = s.raw[index] as SnapPoint
      const session = sessionRef.current
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
        // A parent driving `activeSnapPoint` already knows; echoing it back
        // invites feedback loops.
        if (raw !== p.activeSnapPoint) p.onSnapPointChange?.(raw, index)
      }
      p.onAnimationComplete?.(raw)
      p.onHeightChange?.(visibleHeight())
    }, [dragInfo, indexOfPoint, setOpen, visibleHeight])

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
        setStops(null)
        return
      }
      injectScrollDrawerStyles()
      const next = resolveStops()
      if (next) setStops(next)
    }, [mounted, resolveStops])

    // Re-resolve when the snap config changes while open.
    const pointsKey = (snapPoints ?? DEFAULT_SNAP_POINTS).join('|')
    useLayoutEffect(() => {
      if (!mounted || !openedRef.current) return
      const next = resolveStops()
      if (next && !sameStops(stopsRef.current, next)) setStops(next)
    }, [mounted, pointsKey, dismissible, topInsetPx, resolveStops])

    useLayoutEffect(() => {
      const el = scrollerRef.current
      if (!stops || !el) return
      if (openedRef.current) {
        // Stops moved under an open sheet: hold the same stop at its new height.
        if (!closingRef.current) {
          const i = lastIndexRef.current ?? targetIndex()
          const top = positionsOf(stops)[i]
          if (top !== undefined) el.scrollTop = top
          settle()
        }
        return
      }
      openedRef.current = true
      armedRef.current = false
      closingRef.current = false
      lastIndexRef.current = null
      const pinned = !(latest.current.dismissible ?? true)
      const target = positionsOf(stops)[targetIndex()] ?? 0
      el.scrollTop = pinned ? target : 0
      const sheetH = stops.heights[stops.heights.length - 1] ?? 0
      const targetH = stops.heights[targetIndex()] ?? 0
      el.style.setProperty(
        '--scroll-drawer-hidden',
        `${Math.max(0, sheetH - targetH)}px`,
      )
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
        if (pinned) {
          settle()
          return
        }
        latest.current.onAnimationStart?.(0, stops.heights[targetIndex()] ?? 0)
        scrollToTop(el, target)
        if (Math.abs(el.scrollTop - target) <= EDGE_PX && target > EDGE_PX) {
          settle()
        }
      })
      return () => {
        cancelAnimationFrame(frame)
        entry?.cancel()
        entryFade?.cancel()
      }
    }, [stops, settle, targetIndex, visibleHeight])

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
        // A mouse drag samples where it writes scrollTop; this event lands a
        // frame later and would skew the timing.
        if (session && !session.ended && !mouseDragRef.current) {
          recordSample(session, el.scrollTop)
        }
        if (session && !session.started) {
          session.started = true
          latest.current.onDragStart?.(session.event, dragInfo(session))
        }
        if (
          !frame &&
          (latest.current.onDrag || latest.current.onHeightChange)
        ) {
          frame = requestAnimationFrame(perFrame)
        }
        if (!hasScrollEnd) {
          clearTimeout(timer)
          timer = setTimeout(settle, SETTLE_FALLBACK_MS)
        }
      }
      const onTouchStart = (e: TouchEvent) => {
        sessionRef.current = startSession(e, el.scrollTop)
      }
      const onTouchMove = (e: TouchEvent) => {
        if (sessionRef.current) sessionRef.current.event = e
      }
      const onTouchEnd = (e: TouchEvent) => {
        const session = sessionRef.current
        if (!session) return
        endSession(session, e)
        if (session.started) session.ended = true
        else sessionRef.current = null
      }
      const ro =
        typeof ResizeObserver === 'function'
          ? new ResizeObserver(() => {
              if (!openedRef.current || closingRef.current) return
              const next = resolveStops()
              if (next && !sameStops(stopsRef.current, next)) setStops(next)
            })
          : null
      ro?.observe(el)
      if (
        contentRef.current &&
        (latest.current.snapPoints ?? []).includes('auto')
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
    }, [mounted, settle, dragInfo, visibleHeight, resolveStops])

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

    useEffect(() => {
      const sheet = sheetRef.current
      if (!mounted || !modal || !focusTrap || !sheet) return
      const trap = createFocusTrap(sheet, {
        returnFocusOnDeactivate: true,
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
    }, [mounted, modal, focusTrap])

    const requestClose = () => {
      if ((latest.current.dismissible ?? true) && !closingRef.current) {
        setOpen(false)
      }
    }

    // A mouse can't pan a scroll container, so a mouse drag on the sheet is
    // translated to scrollTop. Same rules as v2: not from controls or
    // `[data-drawer-no-drag]`, not from a list that is scrolled, and only
    // past the slop so a plain click still clicks. Touch never comes here:
    // it pans the scroller natively, even through `pointer-events: none`.
    const onSheetPointerDown = useCallback(
      (e: React.PointerEvent<HTMLElement>) => {
        const el = scrollerRef.current
        if (e.pointerType !== 'mouse' || e.button !== 0 || !el) return
        if (!(e.target instanceof Element)) return
        const target = e.target
        if (target.closest(NEVER_DRAG_SELECTOR)) return
        const control = target.closest(CONTROL_SELECTOR)
        // `data-drawer-drag` opts controls in: the slop keeps a tap a tap, and the
        // click a drag ends on is swallowed below.
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
        let anchor: { y: number; top: number } | null = null
        const move = (ev: PointerEvent) => {
          if (ev.pointerId !== id) return
          if (!anchor) {
            const dx = Math.abs(ev.clientX - downX)
            const dy = Math.abs(ev.clientY - downY)
            if (Math.max(dx, dy) < DRAWER_DRAG_SLOP_PX) return
            // Mostly sideways: leave it to whatever scrolls horizontally here.
            if (dx > dy) {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', end)
              window.removeEventListener('pointercancel', end)
              return
            }
            anchor = { y: ev.clientY, top: el.scrollTop }
            mouseDragRef.current = { id, y: ev.clientY, top: el.scrollTop }
            sessionRef.current = startSession(ev, el.scrollTop)
            el.style.scrollSnapType = 'none'
            el.setAttribute('data-scroll-drawer-dragging', '')
            document.getSelection()?.removeAllRanges()
          }
          ev.preventDefault()
          if (sessionRef.current) sessionRef.current.event = ev
          el.scrollTop = anchor.top - (ev.clientY - anchor.y)
          if (sessionRef.current) recordSample(sessionRef.current, el.scrollTop)
        }
        const end = (ev: PointerEvent) => {
          if (ev.pointerId !== id) return
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', end)
          window.removeEventListener('pointercancel', end)
          if (!anchor) return
          mouseDragRef.current = null
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
          const session = sessionRef.current
          if (session) {
            endSession(session, ev)
            if (session.started) session.ended = true
            else sessionRef.current = null
          }
          const s = stopsRef.current
          if (!s) return
          const pos =
            (latest.current.dismissible ?? true)
              ? [0, ...positionsOf(s)]
              : positionsOf(s)
          const top = pos[nearestIndex(el.scrollTop, pos)] ?? 0
          el.style.scrollSnapType = ''
          if (Math.abs(el.scrollTop - top) <= EDGE_PX) settle()
          else scrollToTop(el, top)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', end)
        window.addEventListener('pointercancel', end)
      },
      [settle],
    )

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
                height: `calc(100dvh - ${bottomInsetPx}px)`,
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
                onKeyDown={(e) => {
                  if (e.key !== 'Escape' || e.defaultPrevented) return
                  if (editableTargetHasContent(e.target)) return
                  e.stopPropagation()
                  requestClose()
                }}
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
  externalRef?: React.RefObject<HTMLElement | null>
}

/**
 * The sheet's inner scroller. With `contentScroll="full"` it is locked until
 * the sheet reaches its top stop, then scrolls and chains back to the sheet at
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
      data-scroll-drawer-content=""
      className={cn('min-h-0 flex-1', className)}
      {...rest}
    />
  )
})

/**
 * v3 drawer: the same API as the v2 `Drawer`, but the sheet is a native
 * scroll-snap container, so a swipe runs on the compositor instead of a
 * JavaScript animation loop.
 *
 * Touch drags the sheet from anywhere. A mouse drags it from anywhere except
 * buttons and links, unless they sit inside `[data-drawer-drag]`, and never
 * from fields or `[data-drawer-no-drag]`.
 */
export const Drawer = Object.assign(DrawerRoot, {
  Content: DrawerContent,
  Scrollable: DrawerScrollable,
  Handle: DrawerHandle,
  Overlay: DrawerOverlay,
})
