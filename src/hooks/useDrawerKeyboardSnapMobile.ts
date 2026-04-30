'use client'

import { type RefObject, useCallback, useEffect, useRef } from 'react'

import { SNAP_POINT } from '../constants'
import type { DrawerRef, SnapPointValue, ViewportInfo } from '../types'

type Options = {
  open: boolean
  isMobile: boolean
  drawerRef: RefObject<DrawerRef | null>
}

/**
 * When the visual viewport reports the soft keyboard (mobile), snap the drawer
 * to MAX; when the keyboard hides, restore the snap point from before it opened.
 */
export function useDrawerKeyboardSnapMobile({
  open,
  isMobile,
  drawerRef,
}: Options) {
  const wasKeyboardOpenRef = useRef(false)
  // SnapPointValue widened to include `'auto'` / `'full'` — the saved snap
  // could be either a numeric stop or one of those tokens, so the restore
  // target must also accept the broader type.
  const snapBeforeKeyboardRef = useRef<SnapPointValue | null>(null)

  useEffect(() => {
    if (!open || !isMobile) {
      wasKeyboardOpenRef.current = false
      snapBeforeKeyboardRef.current = null
    }
  }, [open, isMobile])

  return useCallback(
    (viewport: ViewportInfo) => {
      if (!isMobile || !open) return

      const keyboardOpen = viewport.isKeyboardOpen
      const wasKeyboardOpen = wasKeyboardOpenRef.current

      if (keyboardOpen && !wasKeyboardOpen) {
        const drawer = drawerRef.current
        const current = drawer?.getActiveSnapPoint()
        if (current != null) {
          snapBeforeKeyboardRef.current = current
        }
        drawer?.snapTo(SNAP_POINT.MAX)
      } else if (!keyboardOpen && wasKeyboardOpen) {
        const drawer = drawerRef.current
        const prev = snapBeforeKeyboardRef.current
        snapBeforeKeyboardRef.current = null
        if (prev != null) {
          drawer?.snapTo(prev)
        }
      }

      wasKeyboardOpenRef.current = keyboardOpen
    },
    [isMobile, open, drawerRef],
  )
}
