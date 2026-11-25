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

const KEYBOARD_THRESHOLD_PX = 50

/**
 * The tallest layout height seen at the current width. iOS sometimes shrinks
 * `innerHeight` with the keyboard (it then equals `visualViewport.height` and
 * the page pans instead), so `innerHeight` alone can't show the keyboard.
 */
const baseline = { width: -1, height: 0 }

function layoutBaseline(vvHeight: number): number {
  const width = window.innerWidth
  const height = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight,
    vvHeight,
  )
  if (width !== baseline.width) {
    baseline.width = width
    baseline.height = height
  } else {
    baseline.height = Math.max(baseline.height, height)
  }
  return baseline.height
}

const NOT_TYPED = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

function editableFocused(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLInputElement) return !NOT_TYPED.has(el.type)
  return el instanceof HTMLTextAreaElement || el.isContentEditable
}

// A desktop window resized shorter, or devtools docked below, shrinks the
// layout height with no keyboard involved.
function softKeyboardLikely(): boolean {
  if (navigator.maxTouchPoints > 0) return true
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
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

  const lastRef = useRef<ViewportInfo | null>(null)

  const update = useCallback(
    (onlyIfChanged = false) => {
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
      const base = layoutBaseline(height)
      // Against the baseline only with a field focused: the browser toolbars
      // also move the layout height, by more than the threshold.
      const keyboardHeight = Math.max(
        0,
        innerH - height,
        editableFocused() && softKeyboardLikely() ? base - height : 0,
      )
      const isKeyboardOpen = keyboardHeight > KEYBOARD_THRESHOLD_PX
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

      const prev = lastRef.current
      const same =
        !!prev &&
        prev.height === next.height &&
        prev.offsetTop === next.offsetTop &&
        prev.keyboardHeight === next.keyboardHeight &&
        prev.isKeyboardOpen === next.isKeyboardOpen &&
        prev.layoutBottomInset === next.layoutBottomInset
      if (same && onlyIfChanged) return
      if (!same) lastRef.current = next
      setViewport((current) => (same ? current : next))

      setAvailableHeight(height)
      onViewportChangeRef.current?.(next)
    },
    [enabled],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) {
      lastRef.current = null
      setViewport({ ...DEFAULT_VIEWPORT })
      setAvailableHeight(0)
      return
    }

    const vv = window.visualViewport
    if (!vv) {
      return
    }

    let subscribed = true
    const onViewport = () => update()
    // Focus changes whether the baseline counts, and no viewport event need
    // follow: a blur with the keyboard already down, or a desktop field.
    const onFocus = () => {
      if (subscribed) update(true)
    }
    // During focusout, focus hasn't landed anywhere yet.
    const onFocusOut = () => queueMicrotask(onFocus)
    update()
    vv.addEventListener('resize', onViewport)
    vv.addEventListener('scroll', onViewport)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onFocusOut)

    return () => {
      subscribed = false
      vv.removeEventListener('resize', onViewport)
      vv.removeEventListener('scroll', onViewport)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [enabled, update])

  return {
    ...viewport,
    availableHeight,
  }
}
