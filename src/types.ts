import type { PointerEvent as ReactPointerEvent } from 'react'

import { DRAWER_SIZING } from './constants'

/**
 * Optional class names applied from `Drawer`’s `slots` prop. Merge order for each
 * part is: package defaults → `slots.*` → part’s own `className` (and handle’s
 * `indicatorClassName` where applicable).
 */
export type DrawerSlots = {
  contentClassName?: string
  handleClassName?: string
  handleIndicatorClassName?: string
}

/** A snap point: decimal 0–1 (fraction of available height) or px when value > 1 */
export type SnapPointValue = number

export type DrawerSizingPreset =
  (typeof DRAWER_SIZING)[keyof typeof DRAWER_SIZING]

export type DrawerSizing = DrawerSizingPreset | SnapPointValue[]

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `DRAWER_SIZING.AUTO` = content-sized (default), `FULL` = 100% height, or explicit snap array */
  sizing?: DrawerSizing
  /** Which snap to open to. Ignored for `DRAWER_SIZING.AUTO` / `FULL` */
  defaultSnapPoint?: SnapPointValue
  /** Controlled snap point (raw value, same encoding as sizing array) */
  activeSnapPoint?: SnapPointValue
  /** Drag below lowest snap dismisses the drawer (default true) */
  dismissible?: boolean
  /** Show overlay + lock body scroll (default true) */
  modal?: boolean
  /**
   * Pixels subtracted from visual viewport height when resolving snap heights.
   * Default leaves top space for map chrome (`DRAWER_TOP_INSET_PX`). Use `0`
   * for edge-to-top panels (e.g. full-screen search).
   */
  topInsetPx?: number
  children: React.ReactNode

  /**
   * Merged with the default overlay (`fixed inset-0 z-50 bg-black/50`) when
   * `modal` is true. Use for dimmer, translucent, or invisible backdrops.
   */
  overlayClassName?: string
  /**
   * Class names merged into `Drawer.Content` and `Drawer.Handle` before each
   * part’s own `className` (and handle `indicatorClassName`).
   */
  slots?: DrawerSlots

  onSnapPointChange?: (snapPoint: SnapPointValue, index: number) => void
  onDragStart?: (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: DragInfo,
  ) => void
  onDrag?: (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: DragInfo,
  ) => void
  onDragEnd?: (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: DragEndInfo,
  ) => void
  onAnimationStart?: (from: number, to: number) => void
  onAnimationComplete?: (snapPoint: SnapPointValue) => void
  onViewportChange?: (viewport: ViewportInfo) => void
}

export interface DrawerRef {
  snapTo: (point: SnapPointValue) => void
  expand: () => void
  collapse: () => void
  dismiss: () => void
  getActiveSnapPoint: () => SnapPointValue | null
  getHeight: () => number
}

export interface DragInfo {
  y: number
  velocity: number
  progress: number
}

export interface DragEndInfo extends DragInfo {
  targetSnapPoint: SnapPointValue
}

export interface ViewportInfo {
  height: number
  offsetTop: number
  keyboardHeight: number
  isKeyboardOpen: boolean
}

/** Internal: drag events from motion may be React synthetic pointer events */
export type DrawerDragEvent =
  | ReactPointerEvent<Element>
  | MouseEvent
  | TouchEvent
  | PointerEvent