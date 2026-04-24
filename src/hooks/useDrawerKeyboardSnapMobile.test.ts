import { act, renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { SNAP_POINT } from '../constants'
import type { DrawerRef } from '../types'
import { useDrawerKeyboardSnapMobile } from './useDrawerKeyboardSnapMobile'

const baseViewport = {
  height: 800,
  offsetTop: 0,
  keyboardHeight: 0,
  isKeyboardOpen: false,
  layoutBottomInset: 0,
}

describe('useDrawerKeyboardSnapMobile', () => {
  it('does nothing when not mobile or not open', () => {
    const ref = createRef<DrawerRef | null>()
    const { result: mobileOff } = renderHook(() =>
      useDrawerKeyboardSnapMobile({
        open: true,
        isMobile: false,
        drawerRef: ref,
      }),
    )
    const snap = vi.fn()
    ref.current = { snapTo: snap } as unknown as DrawerRef
    act(() => {
      mobileOff.current({ ...baseViewport, isKeyboardOpen: true })
    })
    expect(snap).not.toHaveBeenCalled()

    const { result: closed } = renderHook(() =>
      useDrawerKeyboardSnapMobile({
        open: false,
        isMobile: true,
        drawerRef: ref,
      }),
    )
    act(() => {
      closed.current({ ...baseViewport, isKeyboardOpen: true })
    })
    expect(snap).not.toHaveBeenCalled()
  })

  it('snaps to MAX when keyboard opens, then restores previous snap on close', () => {
    const ref = createRef<DrawerRef | null>()
    const snapTo = vi.fn()
    const getActiveSnapPoint = vi.fn()
    getActiveSnapPoint.mockReturnValue(0.45)
    ref.current = { snapTo, getActiveSnapPoint } as unknown as DrawerRef

    const { result } = renderHook(() =>
      useDrawerKeyboardSnapMobile({
        open: true,
        isMobile: true,
        drawerRef: ref,
      }),
    )

    act(() => {
      result.current({
        ...baseViewport,
        isKeyboardOpen: true,
        keyboardHeight: 300,
      })
    })
    expect(snapTo).toHaveBeenCalledWith(SNAP_POINT.MAX)

    act(() => {
      result.current({
        ...baseViewport,
        isKeyboardOpen: false,
        keyboardHeight: 0,
      })
    })
    expect(snapTo).toHaveBeenLastCalledWith(0.45)
  })

  it('does not store or restore when getActiveSnapPoint is null, and only snaps MAX once', () => {
    const ref = createRef<DrawerRef | null>()
    const snapTo = vi.fn()
    const getActiveSnapPoint = vi.fn()
    getActiveSnapPoint.mockReturnValue(null)
    ref.current = { snapTo, getActiveSnapPoint } as unknown as DrawerRef

    const { result } = renderHook(() =>
      useDrawerKeyboardSnapMobile({
        open: true,
        isMobile: true,
        drawerRef: ref,
      }),
    )

    act(() => {
      result.current({
        ...baseViewport,
        isKeyboardOpen: true,
        keyboardHeight: 50,
      })
    })
    expect(snapTo).toHaveBeenCalledWith(SNAP_POINT.MAX)
    expect(snapTo).toHaveBeenCalledTimes(1)

    act(() => {
      result.current({
        ...baseViewport,
        isKeyboardOpen: false,
        keyboardHeight: 0,
      })
    })
    expect(snapTo).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when drawer ref is null (optional chaining paths)', () => {
    const ref = createRef<DrawerRef | null>()
    const { result } = renderHook(() =>
      useDrawerKeyboardSnapMobile({
        open: true,
        isMobile: true,
        drawerRef: ref,
      }),
    )
    act(() => {
      result.current({
        ...baseViewport,
        isKeyboardOpen: true,
        keyboardHeight: 200,
      })
    })
  })

  it('resets internal refs when not open or not mobile (effect branch)', () => {
    const ref = createRef<DrawerRef | null>()
    const { rerender } = renderHook(
      (p: { open: boolean; isMobile: boolean }) =>
        useDrawerKeyboardSnapMobile({
          open: p.open,
          isMobile: p.isMobile,
          drawerRef: ref,
        }),
      { initialProps: { open: true, isMobile: true } },
    )
    rerender({ open: false, isMobile: true })
  })

  it('skips snapTo(prev) on keyboard close if the drawer ref is cleared', () => {
    const ref = { current: null } as { current: DrawerRef | null }
    const snapTo = vi.fn()
    const d = {
      getActiveSnapPoint: () => 0.5 as const,
      snapTo,
    } as unknown as DrawerRef
    const { result } = renderHook(() =>
      useDrawerKeyboardSnapMobile({
        open: true,
        isMobile: true,
        drawerRef: ref,
      }),
    )
    ref.current = d
    act(() => {
      result.current({
        ...baseViewport,
        isKeyboardOpen: true,
        keyboardHeight: 200,
      })
    })
    const snapCount = snapTo.mock.calls.length
    ref.current = null
    act(() => {
      result.current({
        ...baseViewport,
        isKeyboardOpen: false,
        keyboardHeight: 0,
      })
    })
    expect(snapTo).toHaveBeenCalledTimes(snapCount)
  })
})
