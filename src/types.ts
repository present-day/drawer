import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react'

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

/**
 * A single snap point.
 *
 * - `number` ≤ 1 → fraction of available drawer height (e.g. `0.5` is half)
 * - `number` > 1 → pixel height (e.g. `480` is 480px)
 * - `'auto'`     → measured intrinsic content height (live, via `ResizeObserver`)
 * - `'full'`     → full available drawer height (viewport minus top inset)
 *
 * Use as elements of `Drawer`’s `snapPoints` array, or as the type of a
 * `defaultSnapPoint` / `activeSnapPoint` value.
 */
export type SnapPoint = number | 'auto' | 'full'

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Snap stops, evaluated bottom-to-top after sorting by resolved pixel height.
   * Defaults to `['auto']` — the drawer height follows the intrinsic content
   * height. Pass `['full']` for a single full-height drawer, or mix tokens
   * with numeric stops, e.g. `['auto', 480, 'full']`.
   */
  snapPoints?: SnapPoint[]
  /**
   * Which snap to open to. When omitted, opens at the largest stop.
   */
  defaultSnapPoint?: SnapPoint
  /**
   * Controlled active snap point. Pair with `setActiveSnapPoint` to fully
   * control snap state from outside the component.
   */
  activeSnapPoint?: SnapPoint
  /**
   * Called whenever the active snap point changes — from drag, ref controls,
   * `defaultSnapPoint` resolution, or programmatic `activeSnapPoint` updates.
   * Named to match the controlled-state setter convention used by Vaul / the
   * shadcn drawer (`setActiveSnapPoint(point)`); we additionally pass the
   * resolved index for callers that need it.
   */
  setActiveSnapPoint?: (point: SnapPoint, index: number) => void
  /** Drag below lowest snap dismisses the drawer (default true) */
  dismissible?: boolean
  /** Show overlay + lock body scroll (default true) */
  modal?: boolean
  /**
   * When `modal` is true, keep keyboard focus within the panel (default true).
   * Set to false if you need to interact with the rest of the page while open
   * or manage focus yourself.
   */
  focusTrap?: boolean
  /**
   * Accessible name when you do not pass `title` (e.g. a short label for screen
   * readers). Prefer `title` (or a visible title in content) for modal drawers.
   */
  ariaLabel?: string
  /**
   * Shown to assistive technology only and referenced as the dialog’s title via
   * `aria-labelledby`. Matches the old Radix pattern: you can pass content here
   * and style it, or use `className` with a visually hidden class on your own
   * markup in `children` instead.
   */
  title?: ReactNode
  /**
   * Shown to assistive technology only and linked with `aria-describedby` when
   * provided.
   */
  description?: ReactNode
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
  onAnimationComplete?: (snapPoint: SnapPoint) => void
  onViewportChange?: (viewport: ViewportInfo) => void
}

export interface DrawerRef {
  snapTo: (point: SnapPoint) => void
  expand: () => void
  collapse: () => void
  dismiss: () => void
  getActiveSnapPoint: () => SnapPoint | null
  getHeight: () => number
}

export interface DragInfo {
  y: number
  velocity: number
  progress: number
}

export interface DragEndInfo extends DragInfo {
  targetSnapPoint: SnapPoint
}

export interface ViewportInfo {
  height: number
  offsetTop: number
  keyboardHeight: number
  isKeyboardOpen: boolean
  /**
   * Pixels to add to `bottom` for `position: fixed` elements so the bottom edge
   * aligns with the **visual** viewport on mobile Safari (layout vs. visual
   * viewport). Equals `max(0, innerHeight - height - offsetTop)`.
   */
  layoutBottomInset: number
}

/** Internal: drag events from motion may be React synthetic pointer events */
export type DrawerDragEvent =
  | ReactPointerEvent<Element>
  | MouseEvent
  | TouchEvent
  | PointerEvent
