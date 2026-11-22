'use client'

import { createFocusTrap } from 'focus-trap'
import type React from 'react'
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useVisualViewport } from '../../hooks/useVisualViewport'
import { lockBody, unlockBody } from '../../utils'
import {
  nearestIndex,
  snapPositions,
  spacerHeight,
  stageOffset,
  supportsScrollTimeline,
  writeBackdropOpacity,
} from './geometry'
import { injectScrollDrawerStyles } from './styles'

export interface ScrollDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Visible sheet heights in px, smallest first. "Fully open" is always an
   * implicit extra stop after these. Opens to the first one, or fully open
   * when empty.
   */
  snapPoints?: number[]
  /** When false the sheet moves between snaps but cannot be swiped, clicked or Escaped closed. Default true. */
  dismissible?: boolean
  /**
   * Called when a scroll settles on a new stop. The index is into
   * `[...snapPoints, fullyOpen]`, so `snapPoints.length` means fully open.
   */
  onSnapChange?: (index: number) => void
  /**
   * `'full'` (default): `ScrollDrawer.Content` scrolls only once the sheet is
   * fully open, and below that a swipe on it moves the sheet. `'always'`: it
   * scrolls at every stop, padded by the part of the sheet below the screen so
   * its last rows are reachable; the sheet then moves from the handle and other
   * chrome, or when the content's scroll chains at its top.
   */
  contentScroll?: 'full' | 'always'
  /** Applied to the sheet. */
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  children?: React.ReactNode
}

type Ctx = { startMouseDrag: (e: React.PointerEvent<HTMLElement>) => void }
const ScrollDrawerContext = createContext<Ctx | null>(null)

const SETTLE_FALLBACK_MS = 120
const CLOSE_FALLBACK_MS = 700
const EDGE_PX = 1

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

/**
 * A non-dismissible sheet has no closed scroll position to scroll to, so it
 * exits by translating the scroller. A transformed scroller turns the fixed
 * backdrop into one positioned in its scrolled content, so the backdrop is
 * shifted back by scrollTop and counter-translated to stay put while it fades.
 * Returns a cancel.
 */
function slideOut(el: HTMLElement, done: () => void): () => void {
  const sheet = el.querySelector<HTMLElement>('[data-scroll-drawer-sheet]')
  const backdrop = el.querySelector<HTMLElement>(
    '[data-scroll-drawer-backdrop]',
  )
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
    [
      {
        translate: `0 ${el.scrollTop}px`,
        opacity: getComputedStyle(backdrop).opacity,
      },
      { translate: `0 ${el.scrollTop - distance}px`, opacity: 0 },
    ],
    EXIT_TIMING,
  )
  let finished = false
  exit.finished.then(
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

function ScrollDrawerRoot({
  open,
  onOpenChange,
  snapPoints = [],
  dismissible = true,
  onSnapChange,
  contentScroll = 'full',
  className,
  children,
  ...aria
}: ScrollDrawerProps) {
  const [mounted, setMounted] = useState(open)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)
  const lastIndexRef = useRef<number | null>(null)
  const dragRef = useRef<{ id: number; y: number; top: number } | null>(null)

  const offset = stageOffset(snapPoints, dismissible)
  const current = {
    snapPoints,
    offset,
    dismissible,
    onOpenChange,
    onSnapChange,
  }
  const latest = useRef(current)
  latest.current = current

  if (open && !mounted) setMounted(true)

  useVisualViewport({
    enabled: mounted,
    onViewportChange: (vp) => {
      scrollerRef.current?.style.setProperty(
        '--visual-viewport-height',
        `${vp.height}px`,
      )
    },
  })

  const positions = useCallback((el: HTMLElement) => {
    const { snapPoints: points, offset: off } = latest.current
    return snapPositions(points, off ?? 0, el.scrollHeight - el.clientHeight)
  }, [])

  const scrollToOpen = useCallback(
    (el: HTMLElement, instant = false) => {
      const pos = positions(el)
      const target =
        (latest.current.snapPoints.length > 0 ? pos[0] : pos[pos.length - 1]) ??
        0
      scrollToTop(el, target, instant)
      return target
    },
    [positions],
  )

  const settle = useCallback(() => {
    const el = scrollerRef.current
    if (!el || dragRef.current) return
    const { dismissible: canDismiss, onOpenChange: change } = latest.current
    if (closingRef.current) {
      if (el.scrollTop <= EDGE_PX) setMounted(false)
      return
    }
    if (canDismiss && el.scrollTop <= EDGE_PX) {
      change(false)
      return
    }
    const pos = positions(el)
    const index = nearestIndex(el.scrollTop, pos)
    const isFull = el.scrollTop >= (pos[pos.length - 1] ?? 0) - EDGE_PX
    el.toggleAttribute('data-scroll-drawer-full', isFull)
    const sheet = sheetRef.current
    if (sheet) {
      // Layout offsets, not getBoundingClientRect: the non-dismissible entry
      // translate may still be running and would inflate the hidden height.
      const hidden =
        sheet.offsetTop + sheet.offsetHeight - el.scrollTop - el.clientHeight
      el.style.setProperty(
        '--scroll-drawer-hidden',
        `${Math.max(0, Math.round(hidden))}px`,
      )
    }
    if (index !== lastIndexRef.current) {
      lastIndexRef.current = index
      latest.current.onSnapChange?.(index)
    }
  }, [positions])

  useLayoutEffect(() => {
    if (!mounted) return
    injectScrollDrawerStyles()
    const el = scrollerRef.current
    if (!el) return
    closingRef.current = false
    lastIndexRef.current = null
    el.scrollTop = 0
    const backdrop = supportsScrollTimeline()
      ? null
      : el.querySelector<HTMLElement>('[data-scroll-drawer-backdrop]')
    if (backdrop) writeBackdropOpacity(el, backdrop)

    // Translating the track instead would grow the scroll area and move the
    // snap areas, and WebKit snaps the sheet fully open for the duration.
    const entry =
      !latest.current.dismissible &&
      !prefersReducedMotion() &&
      typeof el.animate === 'function'
        ? el.animate([{ translate: '0 100%' }, { translate: '0 0' }], {
            duration: 300,
            easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
          })
        : null

    const frame = requestAnimationFrame(() => {
      const target = scrollToOpen(el)
      // Already there (e.g. pinned open): no scroll, so no scrollend to settle on.
      const stationary = Math.abs(el.scrollTop - target) <= EDGE_PX
      if (stationary && (target > EDGE_PX || !latest.current.dismissible)) {
        settle()
      }
    })

    let timer: ReturnType<typeof setTimeout> | undefined
    const hasScrollEnd = 'onscrollend' in window
    const onScroll = () => {
      if (backdrop) writeBackdropOpacity(el, backdrop)
      if (!hasScrollEnd) {
        clearTimeout(timer)
        timer = setTimeout(settle, SETTLE_FALLBACK_MS)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    if (hasScrollEnd) el.addEventListener('scrollend', settle)
    return () => {
      cancelAnimationFrame(frame)
      entry?.cancel()
      clearTimeout(timer)
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', settle)
    }
  }, [mounted, scrollToOpen, settle])

  useEffect(() => {
    if (!mounted) return
    const el = scrollerRef.current
    if (open) {
      if (closingRef.current && el) {
        closingRef.current = false
        scrollToOpen(el)
      }
      return
    }
    if (!el || prefersReducedMotion()) {
      setMounted(false)
      return
    }
    if (!latest.current.dismissible) {
      return slideOut(el, () => setMounted(false))
    }
    if (el.scrollTop <= EDGE_PX) {
      setMounted(false)
      return
    }
    closingRef.current = true
    scrollToTop(el, 0)
    const timer = setTimeout(() => setMounted(false), CLOSE_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [open, mounted, scrollToOpen])

  useEffect(() => {
    if (!mounted) return
    lockBody()
    return unlockBody
  }, [mounted])

  useEffect(() => {
    const sheet = sheetRef.current
    if (!mounted || !sheet) return
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
  }, [mounted])

  const requestClose = () => {
    if (latest.current.dismissible && !closingRef.current) onOpenChange(false)
  }

  const startMouseDrag = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const el = scrollerRef.current
      if (e.pointerType !== 'mouse' || e.button !== 0 || !el) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = { id: e.pointerId, y: e.clientY, top: el.scrollTop }
      el.style.scrollSnapType = 'none'
      const target = e.currentTarget
      const move = (ev: PointerEvent) => {
        const d = dragRef.current
        if (!d || ev.pointerId !== d.id) return
        el.scrollTop = d.top - (ev.clientY - d.y)
      }
      const end = (ev: PointerEvent) => {
        if (dragRef.current?.id !== ev.pointerId) return
        dragRef.current = null
        target.removeEventListener('pointermove', move)
        target.removeEventListener('pointerup', end)
        target.removeEventListener('pointercancel', end)
        const pos = latest.current.dismissible
          ? [0, ...positions(el)]
          : positions(el)
        const top = pos[nearestIndex(el.scrollTop, pos)] ?? 0
        el.style.scrollSnapType = ''
        if (Math.abs(el.scrollTop - top) <= EDGE_PX) settle()
        else scrollToTop(el, top)
      }
      target.addEventListener('pointermove', move)
      target.addEventListener('pointerup', end)
      target.addEventListener('pointercancel', end)
    },
    [positions, settle],
  )

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <ScrollDrawerContext.Provider value={{ startMouseDrag }}>
      <div
        ref={scrollerRef}
        data-scroll-drawer=""
        data-scroll-drawer-dismissible={dismissible ? '' : undefined}
        data-scroll-drawer-content-scroll={contentScroll}
      >
        <div data-scroll-drawer-backdrop="" aria-hidden />
        <div data-scroll-drawer-track="">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            data-scroll-drawer-spacer=""
            style={{ height: spacerHeight(offset) }}
            onClick={requestClose}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal
            tabIndex={-1}
            data-scroll-drawer-sheet=""
            className={className}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                requestClose()
              }
            }}
            {...aria}
          >
            {snapPoints.map((p) => (
              <div
                key={p}
                data-scroll-drawer-marker={p}
                aria-hidden
                style={{ ['--scroll-drawer-snap' as string]: `${p}px` }}
              />
            ))}
            {children}
          </div>
        </div>
      </div>
    </ScrollDrawerContext.Provider>,
    document.body,
  )
}

export const ScrollDrawerHandle = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function ScrollDrawerHandle({ onPointerDown, ...props }, ref) {
  const ctx = useContext(ScrollDrawerContext)
  return (
    <div
      ref={ref}
      data-scroll-drawer-handle=""
      aria-hidden
      {...props}
      onPointerDown={(e) => {
        onPointerDown?.(e)
        if (!e.defaultPrevented) ctx?.startMouseDrag(e)
      }}
    />
  )
})

/** The sheet's inner scroller: locked until the sheet is fully open, then scrolls and chains back to the sheet at its top. */
export const ScrollDrawerContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function ScrollDrawerContent(props, ref) {
  return <div ref={ref} data-scroll-drawer-content="" {...props} />
})

/** Experimental: a drawer whose drag is native scroll-snap, so the swipe runs on the compositor. */
export const ScrollDrawer = Object.assign(ScrollDrawerRoot, {
  Handle: ScrollDrawerHandle,
  Content: ScrollDrawerContent,
})
