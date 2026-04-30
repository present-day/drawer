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
  /**
   * Controlled open state. Pair with `onOpenChange` for fully controlled mode.
   * Omit (and use `defaultOpen`) for uncontrolled mode.
   */
  open?: boolean
  /**
   * Called when the drawer requests an open/close transition. Required in
   * controlled mode; optional in uncontrolled mode.
   */
  onOpenChange?: (open: boolean) => void
  /**
   * Called whenever the drawer transitions from open to closed — whether
   * triggered internally (drag-dismiss, overlay click, escape, `dismiss()`)
   * or by the parent flipping a controlled `open` prop. Mirrors vaul's
   * `onClose` for consumers that want a single hook for close-only side
   * effects without filtering `onOpenChange`.
   */
  onClose?: () => void
  /**
   * Initial open state for uncontrolled mode. Ignored when `open` is provided.
   */
  defaultOpen?: boolean
  /**
   * Snap stops, evaluated bottom-to-top after sorting by resolved pixel height.
   * Defaults to `[‘auto’]` — the drawer height follows the intrinsic content
   * height. Pass `[‘full’]` for a single full-height drawer, or mix tokens
   * with numeric stops, e.g. `[‘auto’, 480, ‘full’]`.
   */
  snapPoints?: SnapPoint[]
  /**
   * Which snap to open to. When omitted, opens at the largest stop.
   */
  defaultSnapPoint?: SnapPoint
  /**
   * Controlled active snap point. Pair with `onSnapPointChange` to observe
   * snap changes initiated by this component; update this prop to drive the
   * drawer to a specific stop from outside.
   */
  activeSnapPoint?: SnapPoint
  /**
   * Called when the drawer initiates a snap change — on drag end, ref control
   * calls (`snapTo`, `expand`, `collapse`), or `defaultSnapPoint` resolution on
   * open. The resolved index is passed alongside the raw `SnapPoint` value for
   * callers that need it.
   *
   * **Not** called for parent-driven updates: when the parent sets
   * `activeSnapPoint` directly the drawer animates to that stop but does not
   * echo the value back via this callback — the parent is already the source
   * of truth and echoing would risk feedback loops.
   */
  onSnapPointChange?: (point: SnapPoint, index: number) => void
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
   * When `true`, only a `Drawer.Handle` element can initiate a drag — touches
   * on the rest of the content area are ignored. Useful when the content area
   * contains its own gestures (e.g. a map or canvas).
   */
  handleOnly?: boolean
  /**
   * Index into `snapPoints` at which the overlay becomes fully opaque (0-based,
   * evaluated against the px-sorted snap array). Below that snap the overlay
   * fades in proportionally as the drawer rises. Omit for the default
   * all-or-nothing overlay that fades over the open animation.
   *
   * @example
   *   // snapPoints={[‘auto’, ‘full’]} — no overlay at ‘auto’, full overlay at ‘full’
   *   fadeFromIndex={1}
   */
  fadeFromIndex?: number
  /**
   * Disables velocity-based snap-skipping: with a fast swipe the drawer only
   * moves one snap stop at a time rather than flying past intermediate stops.
   * Position-based snapping (slow drag, nearest-stop) is unaffected.
   */
  snapToSequentialPoint?: boolean
  /**
   * Set to `true` when this drawer is rendered inside another drawer. Stops
   * pointer events from bubbling to the outer drawer’s drag handlers so the
   * two drawers do not fight over the same gesture.
   */
  nested?: boolean
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
