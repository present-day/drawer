'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { RUBBER_BAND_FACTOR } from '../constants'

export type UseDrawerDragOptions = {
  scrollContainerRef: React.RefObject<HTMLElement | null>
  /** When false, nested scroll is not at top — disable drawer drag to let scroll consume gesture */
  enabled?: boolean
  /** Bumps when the scroll container node is registered so effects re-subscribe */
  scrollAttachGeneration?: number
}

/**
 * Scroll-to-drag handoff: allow drawer vertical drag only when the nested scroller is at top,
 * or when the gesture starts on the handle / non-scroll chrome (caller may widen rules).
 * Non-passive `touchmove` prevents overscroll-at-top from chaining to the page (pull-to-refresh).
 */
export function useDrawerDrag({
  scrollContainerRef,
  enabled = true,
  scrollAttachGeneration = 0,
}: UseDrawerDragOptions) {
  const [scrollAtTop, setScrollAtTop] = useState(true)
  const scrollRafRef = useRef<number | null>(null)

  const updateScrollTop = useCallback(() => {
    if (scrollRafRef.current !== null) return
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null
      const el = scrollContainerRef.current
      setScrollAtTop(!el || el.scrollTop <= 2)
    })
  }, [scrollContainerRef])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    updateScrollTop()
    el.addEventListener('scroll', updateScrollTop, { passive: true })
    return () => {
      el.removeEventListener('scroll', updateScrollTop)
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
    }
  }, [scrollContainerRef, scrollAttachGeneration, updateScrollTop])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el || !enabled) return

    let touchStartY: number | null = null

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? null
      updateScrollTop()
    }

    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY
      if (touchStartY === null || y === undefined) return
      if (el.scrollTop <= 2 && y > touchStartY) {
        e.preventDefault()
      }
    }

    const onTouchEnd = () => {
      touchStartY = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled, scrollContainerRef, scrollAttachGeneration, updateScrollTop])

  const onScrollContainerPointerDown = useCallback(() => {
    updateScrollTop()
  }, [updateScrollTop])

  const drawerDragEnabled = enabled && scrollAtTop

  return {
    drawerDragEnabled,
    /** Pass to motion dragElastic when constraints are active */
    dragElastic: RUBBER_BAND_FACTOR,
    scrollContainerProps: {
      onPointerDownCapture: onScrollContainerPointerDown,
    },
  }
}
