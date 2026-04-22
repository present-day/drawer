'use client'

import { createFocusTrap } from 'focus-trap'
import {
  AnimatePresence,
  animate,
  type MotionStyle,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react'
import type React from 'react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  DRAWER_DRAG_SLOP_PX,
  DRAWER_SIZING,
  DRAWER_TOP_INSET_PX,
  RUBBER_BAND_FACTOR,
  SPRING_CONFIG,
} from '../constants'
import { DrawerContext, type DrawerContextValue } from '../context'
import { DrawerSlotsProvider } from '../drawerSlotsContext'
import { resolveSnapAfterDrag, useDrawerSnap } from '../hooks/useDrawerSnap'
import { useVisualViewport } from '../hooks/useVisualViewport'
import type {
  DragEndInfo,
  DrawerProps,
  DrawerRef,
  SnapPointValue,
} from '../types'
import { cn, getLockCount, lockBody, unlockBody } from '../utils'
import { DrawerContent } from './drawer/DrawerContent'
import { DrawerHandle } from './drawer/DrawerHandle'
import { DrawerOverlay } from './drawer/DrawerOverlay'
import { DrawerScrollable } from './drawer/DrawerScrollable'

const DrawerRoot = forwardRef<DrawerRef, DrawerProps>(
  function DrawerRoot(props, ref) {
    const {
      open,
      onOpenChange,
      sizing = DRAWER_SIZING.AUTO,
      defaultSnapPoint,
      activeSnapPoint,
      dismissible = true,
      modal = true,
      topInsetPx = DRAWER_TOP_INSET_PX,
      children,
      onSnapPointChange,
      onDragStart,
      onDrag,
      onDragEnd,
      onAnimationStart,
      onAnimationComplete,
      onViewportChange,
      overlayClassName,
      slots,
      focusTrap = true,
      ariaLabel,
      title,
      description,
    } = props

    const reduceMotion = useReducedMotion()
    const measureRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLElement | null>(null)
    const lastScrollElRef = useRef<HTMLElement | null>(null)
    const [scrollAttachGeneration, setScrollAttachGeneration] = useState(0)
    const registerScrollContainer = useCallback((el: HTMLElement | null) => {
      scrollContainerRef.current = el
      if (lastScrollElRef.current !== el) {
        lastScrollElRef.current = el
        setScrollAttachGeneration((g) => g + 1)
      }
    }, [])

    const { availableHeight, ...viewport } = useVisualViewport({
      enabled: open,
      onViewportChange,
    })

    const { snapHeights, defaultIndex, resolveSnapToIndex, indexToRawValue } =
      useDrawerSnap({
        sizing,
        viewportHeight: viewport.height || availableHeight,
        topInsetPx,
        defaultSnapPoint,
        contentMeasureRef: measureRef,
      })

    const [snapIndex, setSnapIndex] = useState(defaultIndex)
    const heightMv = useMotionValue(0)
    const dragHeightStartRef = useRef(0)

    type DragSession = {
      pointerId: number
      startY: number
      startH: number
      lastY: number
      lastT: number
      vy: number
      lastDeltaY: number
      /** True after slop exceeded — then pointer capture is active */
      active: boolean
    }
    const dragSessionRef = useRef<DragSession | null>(null)
    const [mounted, setMounted] = useState(false)
    const hasLockedRef = useRef(false)
    const prevOpenForNonModalRef = useRef<boolean | undefined>(undefined)

    const [progressState, setProgressState] = useState(0)
    const [heightState, setHeightState] = useState(0)
    const titleId = useId()
    const descriptionId = useId()
    const panelRef = useRef<HTMLDivElement | null>(null)

    const ctxValue = useMemo<DrawerContextValue>(
      () => ({
        measureRef,
        scrollContainerRef,
        registerScrollContainer,
        scrollAttachGeneration,
      }),
      [registerScrollContainer, scrollAttachGeneration],
    )

    const spring = useMemo(
      () =>
        reduceMotion
          ? { type: 'tween' as const, duration: 0 }
          : { type: 'spring' as const, ...SPRING_CONFIG.default },
      [reduceMotion],
    )

    const panelExitTransition = useMemo(
      () =>
        reduceMotion
          ? { duration: 0 }
          : {
              type: 'tween' as const,
              duration: 0.28,
              ease: [0.32, 0, 0.67, 0] as const,
            },
      [reduceMotion],
    )

    const maxSnap = snapHeights[snapHeights.length - 1] ?? 0
    const minSnap = snapHeights[0] ?? 0

    const updateProgress = useCallback(
      (h: number) => {
        setHeightState(h)
        const p =
          maxSnap > minSnap
            ? Math.min(1, Math.max(0, (h - minSnap) / (maxSnap - minSnap)))
            : 0
        setProgressState(p)
      },
      [maxSnap, minSnap],
    )

    useMotionValueEvent(heightMv, 'change', (h) => updateProgress(h))

    const clampDragHeight = useCallback(
      (h: number) => {
        let out = h
        if (h < minSnap) {
          out = minSnap - (minSnap - h) * RUBBER_BAND_FACTOR
        } else if (h > maxSnap) {
          out = maxSnap + (h - maxSnap) * RUBBER_BAND_FACTOR
        }
        const floor = dismissible ? 0 : minSnap
        return Math.max(floor, Math.min(maxSnap + 96, out))
      },
      [dismissible, maxSnap, minSnap],
    )

    const snapToHeightAnimated = useCallback(
      (
        nextIdx: number,
        dragMeta?: { velocityY: number; endY: number; progress: number },
      ) => {
        const targetH = snapHeights[nextIdx] ?? minSnap
        const fromH = heightMv.get()
        onAnimationStart?.(fromH, targetH)

        const raw = indexToRawValue(nextIdx)
        if (dragMeta && raw !== null) {
          const dragInfo: DragEndInfo = {
            y: dragMeta.endY,
            velocity: dragMeta.velocityY,
            progress: dragMeta.progress,
            targetSnapPoint: raw,
          }
          onDragEnd?.(
            new PointerEvent('pointerup') as unknown as PointerEvent,
            dragInfo,
          )
          onSnapPointChange?.(raw, nextIdx)
        }

        animate(heightMv, targetH, {
          ...spring,
          onComplete: () => {
            heightMv.set(targetH)
            updateProgress(targetH)
            if (raw !== null) onAnimationComplete?.(raw)
          },
        })
      },
      [
        heightMv,
        indexToRawValue,
        minSnap,
        onAnimationComplete,
        onAnimationStart,
        onDragEnd,
        onSnapPointChange,
        snapHeights,
        spring,
        updateProgress,
      ],
    )

    const introStartedRef = useRef(false)
    const readyForResnapRef = useRef(false)
    const resetDrawerMotionAfterExit = useCallback(() => {
      heightMv.set(0)
      updateProgress(0)
    }, [heightMv, updateProgress])

    useEffect(() => {
      if (!open || snapHeights.length === 0) {
        if (!open) {
          introStartedRef.current = false
          readyForResnapRef.current = false
        }
        return
      }
      const h = snapHeights[defaultIndex] ?? minSnap
      if (h < 32) return
      if (introStartedRef.current) return
      introStartedRef.current = true
      setSnapIndex(defaultIndex)
      heightMv.set(0)
      updateProgress(0)
      animate(heightMv, h, {
        ...spring,
        onComplete: () => {
          heightMv.set(h)
          updateProgress(h)
          readyForResnapRef.current = true
        },
      })
    }, [
      open,
      defaultIndex,
      minSnap,
      snapHeights,
      heightMv,
      spring,
      updateProgress,
    ])

    // Re-snap when snap heights change while open (e.g. virtual keyboard show/hide)
    useEffect(() => {
      if (!open || !readyForResnapRef.current || snapHeights.length === 0) {
        return
      }
      if (dragSessionRef.current) return

      const targetIdx = Math.min(snapIndex, snapHeights.length - 1)
      const targetH = snapHeights[targetIdx] ?? minSnap

      if (Math.abs(heightMv.get() - targetH) < 2) return

      animate(heightMv, targetH, {
        ...spring,
        onComplete: () => {
          heightMv.set(targetH)
          updateProgress(targetH)
        },
      })
    }, [
      snapHeights,
      open,
      snapIndex,
      heightMv,
      minSnap,
      spring,
      updateProgress,
    ])

    const lastActiveSnapRef = useRef<SnapPointValue | undefined>(undefined)
    useEffect(() => {
      if (!open) {
        lastActiveSnapRef.current = undefined
      }
    }, [open])

    useEffect(() => {
      if (activeSnapPoint === undefined || !open) return
      if (lastActiveSnapRef.current === activeSnapPoint) return
      lastActiveSnapRef.current = activeSnapPoint
      const idx = resolveSnapToIndex(activeSnapPoint)
      setSnapIndex(idx)
      snapToHeightAnimated(idx)
    }, [activeSnapPoint, open, resolveSnapToIndex, snapToHeightAnimated])

    useEffect(() => {
      setMounted(true)
    }, [])

    useEffect(() => {
      if (!open) return
      const root = document.documentElement
      const prev = root.style.overscrollBehaviorY
      root.style.overscrollBehaviorY = 'none'
      return () => {
        root.style.overscrollBehaviorY = prev
      }
    }, [open])

    useEffect(() => {
      if (!modal) {
        const wasOpen = prevOpenForNonModalRef.current
        prevOpenForNonModalRef.current = open

        if (typeof window === 'undefined') return

        if (open) {
          const id = window.requestAnimationFrame(() => {
            document.body.style.pointerEvents = 'auto'
          })
          return () => window.cancelAnimationFrame(id)
        }

        // Nested Radix dialogs / scroll lock can set body overflow even though this
        // Drawer does not use lockBody. Only repair when closing from an open state
        // (skip initial mount with open=false so we do not clear other overlays).
        if (wasOpen === true) {
          const id = window.requestAnimationFrame(() => {
            document.body.style.pointerEvents = ''
            while (getLockCount() > 0) {
              unlockBody()
            }
            if (document.body.style.overflow === 'hidden') {
              document.body.style.removeProperty('overflow')
            }
          })
          return () => window.cancelAnimationFrame(id)
        }

        return
      }

      if (open && !hasLockedRef.current) {
        lockBody()
        hasLockedRef.current = true
      } else if (!open && hasLockedRef.current) {
        unlockBody()
        hasLockedRef.current = false
      }
      return () => {
        if (hasLockedRef.current) {
          unlockBody()
          hasLockedRef.current = false
        }
      }
    }, [modal, open])

    const useFocusTrap = open && modal && focusTrap
    useLayoutEffect(() => {
      if (!useFocusTrap) return
      const el = panelRef.current
      if (!el) return
      const trap = createFocusTrap(el, {
        returnFocusOnDeactivate: true,
        fallbackFocus: el,
        escapeDeactivates: false,
        allowOutsideClick: true,
        clickOutsideDeactivates: false,
      })
      const id = requestAnimationFrame(() => {
        try {
          trap.activate()
        } catch {
          /* istanbul ignore next */
        }
      })
      return () => {
        cancelAnimationFrame(id)
        try {
          trap.deactivate()
        } catch {
          /* istanbul ignore next */
        }
      }
    }, [useFocusTrap])

    const handleDialogKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape' && dismissible) {
          e.stopPropagation()
          onOpenChange(false)
        }
      },
      [dismissible, onOpenChange],
    )

    const runSnapFromVisible = useCallback(
      (
        visibleHeight: number,
        velocityY: number,
        pointerMeta: { endDeltaY: number },
      ) => {
        const decision = resolveSnapAfterDrag({
          visibleHeight,
          velocityY,
          heightsAsc: snapHeights,
          dismissible,
        })

        if (decision.type === 'dismiss') {
          animate(heightMv, 0, {
            ...spring,
            onComplete: () => {
              heightMv.set(0)
              updateProgress(0)
              onOpenChange(false)
            },
          })
          return
        }

        const nextIdx = decision.index
        setSnapIndex(nextIdx)
        const p =
          maxSnap > minSnap
            ? Math.min(
                1,
                Math.max(0, (visibleHeight - minSnap) / (maxSnap - minSnap)),
              )
            : 0
        snapToHeightAnimated(nextIdx, {
          velocityY,
          endY: pointerMeta.endDeltaY,
          progress: p,
        })
      },
      [
        dismissible,
        heightMv,
        maxSnap,
        minSnap,
        onOpenChange,
        snapHeights,
        snapToHeightAnimated,
        spring,
        updateProgress,
      ],
    )

    useImperativeHandle(
      ref,
      () => ({
        snapTo: (point: SnapPointValue) => {
          const idx = resolveSnapToIndex(point)
          setSnapIndex(idx)
          snapToHeightAnimated(idx)
        },
        expand: () => {
          const idx = Math.max(0, snapHeights.length - 1)
          setSnapIndex(idx)
          snapToHeightAnimated(idx)
        },
        collapse: () => {
          setSnapIndex(0)
          snapToHeightAnimated(0)
        },
        dismiss: () => onOpenChange(false),
        getActiveSnapPoint: () => indexToRawValue(snapIndex),
        getHeight: () => heightMv.get(),
      }),
      [
        heightMv,
        indexToRawValue,
        onOpenChange,
        resolveSnapToIndex,
        snapHeights.length,
        snapIndex,
        snapToHeightAnimated,
      ],
    )

    const shouldIgnorePointerTarget = useCallback(
      (target: EventTarget | null) => {
        if (!(target instanceof Element)) return true
        return Boolean(
          target.closest(
            'button, a, input, textarea, select, [contenteditable="true"], [data-drawer-no-drag]',
          ),
        )
      },
      [],
    )

    const handleDrawerPointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        if (snapHeights.length === 0) return
        if (shouldIgnorePointerTarget(e.target)) return

        const t = e.target as HTMLElement
        if (t.closest('[data-drawer-scroll]')) {
          const scrollEl = scrollContainerRef.current
          if (scrollEl && scrollEl.scrollTop > 0) return
        }

        const H = heightMv.get()
        const now = performance.now()
        dragSessionRef.current = {
          pointerId: e.pointerId,
          startY: e.clientY,
          startH: H,
          lastY: e.clientY,
          lastT: now,
          vy: 0,
          lastDeltaY: 0,
          active: false,
        }
      },
      [
        heightMv,
        scrollContainerRef,
        shouldIgnorePointerTarget,
        snapHeights.length,
      ],
    )

    const handleDrawerPointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const s = dragSessionRef.current
        if (!s || s.pointerId !== e.pointerId) return

        const deltaY = e.clientY - s.startY

        if (!s.active) {
          if (Math.abs(deltaY) < DRAWER_DRAG_SLOP_PX) return
          s.active = true
          dragHeightStartRef.current = heightMv.get()
          s.startH = heightMv.get()
          s.startY = e.clientY
          s.lastY = e.clientY
          s.lastT = performance.now()
          s.lastDeltaY = 0
          e.currentTarget.setPointerCapture(e.pointerId)

          const H = heightMv.get()
          const p =
            maxSnap > minSnap
              ? Math.min(1, Math.max(0, (H - minSnap) / (maxSnap - minSnap)))
              : 0
          onDragStart?.(e.nativeEvent, {
            y: 0,
            velocity: 0,
            progress: p,
          })
        }

        e.preventDefault()

        const now = performance.now()
        const dt = Math.max(1, now - s.lastT)
        s.vy = ((e.clientY - s.lastY) / dt) * 1000
        s.lastY = e.clientY
        s.lastT = now

        const dragDelta = e.clientY - s.startY
        s.lastDeltaY = dragDelta

        const rawH = s.startH - dragDelta
        const clamped = clampDragHeight(rawH)
        heightMv.set(clamped)

        const progress =
          maxSnap > minSnap
            ? Math.min(
                1,
                Math.max(0, (clamped - minSnap) / (maxSnap - minSnap)),
              )
            : 0

        onDrag?.(e.nativeEvent, {
          y: dragDelta,
          velocity: s.vy,
          progress,
        })
      },
      [clampDragHeight, heightMv, maxSnap, minSnap, onDrag, onDragStart],
    )

    const endDragSession = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const s = dragSessionRef.current
        if (!s || s.pointerId !== e.pointerId) return

        const wasActive = s.active
        const visible = heightMv.get()
        const vy = s.vy
        const endDeltaY = s.lastDeltaY
        dragSessionRef.current = null

        if (wasActive) {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId)
          } catch {
            // already released
          }
          runSnapFromVisible(visible, vy, { endDeltaY })
        }
      },
      [heightMv, runSnapFromVisible],
    )

    if (!mounted) {
      return null
    }
    /* istanbul ignore next 3 -- not reachable in the browser; guards SSR-only bundles */
    if (typeof document === 'undefined') {
      return null
    }

    const drawer = (
      <AnimatePresence onExitComplete={resetDrawerMotionAfterExit}>
        {open ? (
          <>
            {modal ? (
              <motion.button
                type="button"
                key="drawer-overlay"
                aria-hidden
                tabIndex={-1}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
                className={cn(
                  'fixed inset-0 z-50 bg-black/50',
                  overlayClassName,
                )}
                onClick={() => dismissible && onOpenChange(false)}
              />
            ) : null}
            <motion.div
              ref={panelRef}
              key="drawer-panel"
              role="dialog"
              aria-modal={modal}
              aria-label={title == null ? ariaLabel : undefined}
              aria-labelledby={title == null ? undefined : titleId}
              aria-describedby={description ? descriptionId : undefined}
              tabIndex={open && modal ? -1 : undefined}
              style={
                {
                  height: heightMv,
                  ['--drawer-height' as string]: `${heightState}px`,
                  ['--drawer-progress' as string]: progressState,
                  ['--drawer-available-height' as string]: `${availableHeight}px`,
                } as unknown as MotionStyle
              }
              initial={false}
              exit={{ y: '100%', transition: panelExitTransition }}
              className={cn(
                'fixed inset-x-0 bottom-0 z-50 flex max-h-dvh touch-none flex-col outline-none pointer-events-auto overscroll-y-none',
              )}
              onKeyDown={handleDialogKeyDown}
              onPointerDown={handleDrawerPointerDown}
              onPointerMove={handleDrawerPointerMove}
              onPointerUp={endDragSession}
              onPointerCancel={endDragSession}
            >
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
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    )

    return createPortal(
      <DrawerContext.Provider value={ctxValue}>
        {drawer}
      </DrawerContext.Provider>,
      document.body,
    )
  },
)

export const Drawer = Object.assign(DrawerRoot, {
  Content: DrawerContent,
  Scrollable: DrawerScrollable,
  Handle: DrawerHandle,
  Overlay: DrawerOverlay,
})

export type { DrawerProps, DrawerRef }
