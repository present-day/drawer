'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { ViewportInfo } from '../types'

export type UseVisualViewportOptions = {
  enabled?: boolean
  onViewportChange?: (viewport: ViewportInfo) => void
}

export type UseVisualViewportResult = ViewportInfo & {
  /** Height available for the drawer (visual viewport minus top inset) */
  availableHeight: number
}

const DEFAULT_VIEWPORT: ViewportInfo = {
  height: 0,
  offsetTop: 0,
  keyboardHeight: 0,
  isKeyboardOpen: false,
  layoutBottomInset: 0,
}

/**
 * Tracks visualViewport height/offsetTop, derives keyboard state, and exposes
 * keyboard-aware available height for snap resolution.
 */
export function useVisualViewport(
  options: UseVisualViewportOptions = {},
): UseVisualViewportResult {
  const { enabled = true, onViewportChange } = options
  const onViewportChangeRef = useRef(onViewportChange)
  onViewportChangeRef.current = onViewportChange

  const [viewport, setViewport] = useState<ViewportInfo>(() => ({
    ...DEFAULT_VIEWPORT,
  }))

  const [availableHeight, setAvailableHeight] = useState(0)

  const update = useCallback(() => {
    if (typeof window === 'undefined' || !enabled) {
      return
    }
    const vv = window.visualViewport
    if (!vv) {
      return
    }

    // Applied synchronously: the keyboard is already animating when the event
    // fires, so any deferral (rAF batching included) shows up as the panel
    // trailing the keyboard. React batches the setStates below on its own.
    const height = vv.height
    const offsetTop = vv.offsetTop
    const innerH = window.innerHeight
    const keyboardHeight = Math.max(0, innerH - height)
    const isKeyboardOpen = keyboardHeight > 50
    // The inset exists to dock the panel above the soft keyboard. When no
    // keyboard is present it is forced to 0 rather than trusting the
    // arithmetic: after dismissal iOS can leave vv.height/offsetTop slightly
    // short of the layout viewport, and that residual would hold the panel
    // lifted off the bottom edge indefinitely.
    const layoutBottomInset = isKeyboardOpen
      ? Math.max(0, Math.round(innerH - height - offsetTop))
      : 0

    const next: ViewportInfo = {
      height,
      offsetTop,
      keyboardHeight,
      isKeyboardOpen,
      layoutBottomInset,
    }

    setViewport((prev) => {
      if (
        prev.height === next.height &&
        prev.offsetTop === next.offsetTop &&
        prev.keyboardHeight === next.keyboardHeight &&
        prev.isKeyboardOpen === next.isKeyboardOpen &&
        prev.layoutBottomInset === next.layoutBottomInset
      ) {
        return prev
      }
      return next
    })

    setAvailableHeight(height)
    onViewportChangeRef.current?.(next)
  }, [enabled])

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) {
      setViewport({ ...DEFAULT_VIEWPORT })
      setAvailableHeight(0)
      return
    }

    const vv = window.visualViewport
    if (!vv) {
      return
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled, update])

  return {
    ...viewport,
    availableHeight,
  }
}
