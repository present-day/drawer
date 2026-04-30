import type { SnapPoint } from './types'

/** Labels for `useDrawerContext` error messages (keep in sync with compound components). */
export const DRAWER_CONTEXT_CONSUMER = {
  Content: 'Drawer.Content',
  Scrollable: 'Drawer.Scrollable',
} as const

/**
 * Predefined snap points for the `Drawer`’s `snapPoints` prop.
 *
 * Each member is a {@link SnapPoint}: a pixel value (`> 1`), a fraction of
 * available height (`≤ 1`), or one of the string tokens `'auto'` / `'full'`.
 *
 * - `AUTO` — content-fit (live `ResizeObserver` measurement)
 * - `PEEK` — small fixed peek (80px)
 * - `QUARTER` / `THIRD` / `HALF` / `TWO_THIRDS` / `THREE_QUARTERS` — fractions
 * - `NEAR_FULL` — `0.9` of available height (was `SNAP_POINT.FULL` pre-v2)
 * - `MAX` — full available drawer height as a fraction (`1`)
 * - `FULL` — full available drawer height as a token; equivalent to `MAX`
 *   but composes with mixed arrays like `['auto', 480, 'full']`
 *
 * @example
 *   <Drawer snapPoints={[SNAP_POINT.AUTO, 480, SNAP_POINT.FULL]} />
 */
export const SNAP_POINT = {
  AUTO: 'auto',
  PEEK: 80,
  QUARTER: 0.25,
  THIRD: 0.33,
  HALF: 0.5,
  TWO_THIRDS: 0.66,
  THREE_QUARTERS: 0.75,
  NEAR_FULL: 0.9,
  MAX: 1,
  FULL: 'full',
} as const satisfies Record<string, SnapPoint>

export const SPRING_CONFIG = {
  default: { stiffness: 400, damping: 40, mass: 1 },
  gentle: { stiffness: 200, damping: 30, mass: 1 },
  snappy: { stiffness: 600, damping: 35, mass: 0.8 },
} as const

/** Lower = easier to dismiss the drawer with a downward drag (mobile). */
export const DISMISS_THRESHOLD_PX = 56
export const VELOCITY_THRESHOLD = 380
export const RUBBER_BAND_FACTOR = 0.3

/** Pixels of vertical movement before drawer drag activates (lower = easier to start dragging). */
export const DRAWER_DRAG_SLOP_PX = 3

/** Top inset so the drawer doesn't touch top */
export const DRAWER_TOP_INSET_PX = 96
