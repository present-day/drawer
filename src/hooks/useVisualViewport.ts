'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { ViewportInfo } from '../types'

export type UseVisualViewportOptions = {
  enabled?: boolean
  onViewportChange?: (viewport: ViewportInfo) => void
}

export type UseVisualViewportResult = ViewportInfo & {
  /** Height available for a bottom sheet (visual viewport minus top inset) */
  availableHeight: number
}

const DEFAULT_VIEWPORT: ViewportInfo = {
  height: 0,
  offsetTop: 0,
  keyboardHeight: 0,
  isKeyboardOpen: false,
}

/**
 * Tracks visualViewport height/offsetTop, derives keyboard state, and exposes
 * keyboard-aware available height for snap resolution.
 */
export function useVisualViewport(
  options: UseVisualViewportOptions = {},
): UseVisualViewportResult {
  const { enabled = true, onViewportChange } = options
  const rafRef = useRef(0)
  const onViewportChangeRef = useRef(onViewportChange)
  onViewportChangeRef.current = onViewportChange

  const [viewport, setViewport] = useState<ViewportInfo>(() => ({
    ...DEFAULT_VIEWPORT,
  }))

  const [availableHeight, setAvailableHeight] = useState(0)

  const update = useCallback(() => {
    if (typeof window === 'undefined' || !enabled) return
    const vv = window.visualViewport
    if (!vv) return

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const height = vv.height
      const offsetTop = vv.offsetTop
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height)
      const isKeyboardOpen = keyboardHeight > 50

      const next: ViewportInfo = {
        height,
        offsetTop,
        keyboardHeight,
        isKeyboardOpen,
      }

      setViewport((prev) => {
        if (
          prev.height === next.height &&
          prev.offsetTop === next.offsetTop &&
          prev.keyboardHeight === next.keyboardHeight &&
          prev.isKeyboardOpen === next.isKeyboardOpen
        ) {
          return prev
        }
        return next
      })

      setAvailableHeight(height)
      onViewportChangeRef.current?.(next)
    })
  }, [enabled])

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) {
      setViewport({ ...DEFAULT_VIEWPORT })
      setAvailableHeight(0)
      return
    }

    const vv = window.visualViewport
    if (!vv) return

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      cancelAnimationFrame(rafRef.current)
    }
  }, [enabled, update])

  return {
    ...viewport,
    availableHeight,
  }
}