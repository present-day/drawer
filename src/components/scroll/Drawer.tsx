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
import { DRAWER_TOP_INSET_PX } from '../../constants'
import { DrawerSlotsProvider, useDrawerSlots } from '../../drawerSlotsContext'
import {
  measureIntrinsicAutoHeight,
  resolveSnapPointsToHeights,
  resolveSnapValueToPx,
} from '../../hooks/useDrawerSnap'
import { useVisualViewport } from '../../hooks/useVisualViewport'
import type { DragInfo, DrawerProps, DrawerRef, SnapPoint } from '../../types'
import { cn, editableTargetHasContent, lockBody, unlockBody } from '../../utils'
import { DrawerHandle, type DrawerHandleProps } from '../drawer/DrawerHandle'
import { DrawerOverlay } from '../drawer/DrawerOverlay'
import {
  type BackdropRange,
  nearestIndex,
  supportsScrollTimeline,
  writeBackdropOpacity,
} from './geometry'
import { injectScrollDrawerStyles } from './styles'

const DEFAULT_SNAP_POINTS: readonly SnapPoint[] = ['auto']
const SETTLE_FALLBACK_MS = 120
const CLOSE_FALLBACK_MS = 700
const EDGE_PX = 1

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
}

type Ctx = {
  startMouseDrag: (e: React.PointerEvent<HTMLElement>) => void
  registerContent: (el: HTMLElement | null) => void
}
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
    return { start: 0, end: pos[0] ?? 0, min: 0 }
  }
  const i = Math.max(0, Math.min(fadeFromIndex, pos.length - 1))
  return { start: i > 0 ? (pos[i - 1] ?? 0) : 0, end: pos[i] ?? 0, min: 0 }
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

    const dragInfo = useCallback((): DragInfo => {
      const el = scrollerRef.current
      const s = stopsRef.current
      const pos = s ? positionsOf(s) : []
      const max = pos[pos.length - 1] ?? 0
      return {
        y: visibleHeight(),
        velocity: 0,
        progress: el && max > 0 ? Math.min(1, el.scrollTop / max) : 1,
      }
    }, [visibleHeight])

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
      el.toggleAttribute('data-scroll-drawer-full', index === pos.length - 1)
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
          p.onDragEnd?.(session.event, { ...dragInfo(), targetSnapPoint: raw })
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
    }, [dragInfo, setOpen, visibleHeight])

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
    }, [stops, settle, targetIndex])

    useEffect(() => {
      const el = scrollerRef.current
      if (!mounted || !el) return
      const backdrop = supportsScrollTimeline() ? null : backdropRef.current
      const range = () => {
        const s = stopsRef.current
        const r = s
          ? backdropRange(s, latest.current.fadeFromIndex)
          : { start: 0, end: 0, min: 0 }
        const min = backdrop
          ? Number.parseFloat(
              getComputedStyle(backdrop).getPropertyValue(
                '--scroll-drawer-backdrop-min',
              ),
            ) || 0
          : 0
        return { ...r, min }
      }
      if (backdrop) writeBackdropOpacity(el, backdrop, range())

      let timer: ReturnType<typeof setTimeout> | undefined
      let frame = 0
      const hasScrollEnd = 'onscrollend' in window
      const perFrame = () => {
        frame = 0
        const session = sessionRef.current
        const p = latest.current
        if (session?.started && p.onDrag) p.onDrag(session.event, dragInfo())
        p.onHeightChange?.(visibleHeight())
      }
      const onScroll = () => {
        if (el.scrollTop > EDGE_PX) armedRef.current = true
        if (backdrop) writeBackdropOpacity(el, backdrop, range())
        const session = sessionRef.current
        if (session && !session.started) {
          session.started = true
          latest.current.onDragStart?.(session.event, dragInfo())
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
        sessionRef.current = { event: e, started: false, ended: false }
      }
      const onTouchMove = (e: TouchEvent) => {
        if (sessionRef.current) sessionRef.current.event = e
      }
      const onTouchEnd = (e: TouchEvent) => {
        const session = sessionRef.current
        if (!session) return
        session.event = e
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
        return slideOut(el, backdropRef.current, () => setMounted(false))
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

    const startMouseDrag = useCallback(
      (e: React.PointerEvent<HTMLElement>) => {
        const el = scrollerRef.current
        if (e.pointerType !== 'mouse' || e.button !== 0 || !el) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        mouseDragRef.current = {
          id: e.pointerId,
          y: e.clientY,
          top: el.scrollTop,
        }
        sessionRef.current = {
          event: e.nativeEvent,
          started: false,
          ended: false,
        }
        el.style.scrollSnapType = 'none'
        const target = e.currentTarget
        const move = (ev: PointerEvent) => {
          const d = mouseDragRef.current
          if (!d || ev.pointerId !== d.id) return
          if (sessionRef.current) sessionRef.current.event = ev
          el.scrollTop = d.top - (ev.clientY - d.y)
        }
        const end = (ev: PointerEvent) => {
          if (mouseDragRef.current?.id !== ev.pointerId) return
          mouseDragRef.current = null
          target.removeEventListener('pointermove', move)
          target.removeEventListener('pointerup', end)
          target.removeEventListener('pointercancel', end)
          const session = sessionRef.current
          if (session) {
            session.event = ev
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
        target.addEventListener('pointermove', move)
        target.addEventListener('pointerup', end)
        target.addEventListener('pointercancel', end)
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
      <ScrollEngineContext.Provider value={{ startMouseDrag, registerContent }}>
        <div
          data-scroll-drawer-root=""
          data-scroll-drawer-pinned={pinned ? '' : undefined}
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

/** Grab handle. Touch drags scroll natively; a mouse drag is translated to `scrollTop`. */
export const DrawerHandleScroll = forwardRef<HTMLDivElement, DrawerHandleProps>(
  function DrawerHandleScroll({ onPointerDown, ...props }, ref) {
    const ctx = useContext(ScrollEngineContext)
    return (
      <DrawerHandle
        ref={ref}
        {...props}
        onPointerDown={(e) => {
          onPointerDown?.(e)
          if (!e.defaultPrevented) ctx?.startMouseDrag(e)
        }}
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
 */
export const Drawer = Object.assign(DrawerRoot, {
  Content: DrawerContent,
  Scrollable: DrawerScrollable,
  Handle: DrawerHandleScroll,
  Overlay: DrawerOverlay,
})
