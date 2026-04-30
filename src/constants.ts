/** Labels for `useDrawerContext` error messages (keep in sync with compound components). */
export const DRAWER_CONTEXT_CONSUMER = {
  Content: 'Drawer.Content',
  Scrollable: 'Drawer.Scrollable',
} as const

/** Preset `sizing` modes for `Drawer` (content-sized, full height, or explicit snap array). */
export const DRAWER_SIZING = {
  AUTO: 'auto',
  FULL: 'full',
} as const

export const SNAP_POINT = {
  PEEK: 80,
  QUARTER: 0.25,
  THIRD: 0.33,
  HALF: 0.5,
  TWO_THIRDS: 0.66,
  THREE_QUARTERS: 0.75,
  FULL: 0.9,
  MAX: 1,
  /**
   * Resolves to the measured intrinsic content height (the same value
   * `DRAWER_SIZING.AUTO` produces). Use as one snap stop within a sizing
   * array to mix a content-fit stop with explicit pixel/fraction stops:
   * `sizing={[SNAP_POINT.AUTO, 480, DRAWER_SIZING.FULL]}`.
   *
   * Note: `DRAWER_SIZING.FULL` is also accepted inside the snap array (it
   * resolves to the full available drawer height). It is intentionally not
   * re-exported here as `SNAP_POINT.FULL` because `SNAP_POINT.FULL` already
   * exists with a different value (`0.9`).
   */
  AUTO: 'auto',
} as const

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
