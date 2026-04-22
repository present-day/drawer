'use client'

import {
  AnimatePresence,
  type MotionStyle,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react'
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import {
  DrawerContent,
  DrawerHandle,
  DrawerOverlay,
  DrawerScrollable,
} from './DrawerParts'
import {
  DrawerContext,
  type DrawerContextValue,
} from '../context'
import {
  BOTTOM_SHEET_DRAG_SLOP_PX,
  DRAWER_SIZING,
  DRAWER_TOP_INSET_PX,
  RUBBER_BAND_FACTOR,
  SPRING_CONFIG,
} from '../constants'
import type {
  DrawerProps,
  DrawerRef,
  BottomSheetProps,
  BottomSheetRef,
  DragEndInfo,
  SnapPointValue,
} from '../types'
import {
  resolveSnapAfterDrag,
  useDrawerSnap,
} from '../hooks/useDrawerSnap'
import { useVisualViewport } from '../hooks/useVisualViewport'
import { getLockCount, lockBody, unlockBody, cn } from '../utils'

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
    const resetSheetMotionAfterExit = useCallback(() => {
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
        // sheet does not use lockBody. Only repair when closing from an open state
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
            'button, a, input, textarea, select, [contenteditable="true"], [data-bottom-sheet-no-drag]',
          ),
        )
      },
      [],
    )

    const handleSheetPointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        if (snapHeights.length === 0) return
        if (shouldIgnorePointerTarget(e.target)) return

        const t = e.target as HTMLElement
        if (t.closest('[data-bottom-sheet-scroll]')) {
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

    const handleSheetPointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const s = dragSessionRef.current
        if (!s || s.pointerId !== e.pointerId) return

        const deltaY = e.clientY - s.startY

        if (!s.active) {
          if (Math.abs(deltaY) < BOTTOM_SHEET_DRAG_SLOP_PX) return
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

    if (!mounted || typeof document === 'undefined') return null

    const sheet = (
      <AnimatePresence onExitComplete={resetSheetMotionAfterExit}>
        {open ? (
          <>
            {modal ? (
              <motion.button
                type="button"
                key="bottom-sheet-overlay"
                aria-hidden
                tabIndex={-1}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/50"
                onClick={() => dismissible && onOpenChange(false)}
              />
            ) : null}
            <motion.div
              key="bottom-sheet-panel"
              role="dialog"
              aria-modal={modal}
              style={
                {
                  height: heightMv,
                  ['--bottom-sheet-height' as string]: `${heightState}px`,
                  ['--bottom-sheet-progress' as string]: progressState,
                  ['--bottom-sheet-available-height' as string]: `${availableHeight}px`,
                } as unknown as MotionStyle
              }
              initial={false}
              exit={{ y: '100%', transition: panelExitTransition }}
              className={cn(
                'fixed inset-x-0 bottom-0 z-50 flex max-h-dvh touch-none flex-col outline-none pointer-events-auto overscroll-y-none',
              )}
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={endDragSession}
              onPointerCancel={endDragSession}
            >
              {children}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    )

    return createPortal(
      <DrawerContext.Provider value={ctxValue}>
        {sheet}
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

// Backward compatibility
export const BottomSheet = Drawer
export type { BottomSheetProps, BottomSheetRef }