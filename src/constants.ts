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

// Keep bottom sheet constants for backward compatibility
export const BOTTOM_SHEET_CONTEXT_CONSUMER = DRAWER_CONTEXT_CONSUMER
export const BOTTOM_SHEET_SIZING = DRAWER_SIZING

export const SNAP_POINT = {
  PEEK: 80,
  QUARTER: 0.25,
  THIRD: 0.33,
  HALF: 0.5,
  TWO_THIRDS: 0.66,
  THREE_QUARTERS: 0.75,
  FULL: 0.9,
  MAX: 1,
} as const

export const SPRING_CONFIG = {
  default: { stiffness: 400, damping: 40, mass: 1 },
  gentle: { stiffness: 200, damping: 30, mass: 1 },
  snappy: { stiffness: 600, damping: 35, mass: 0.8 },
} as const

/** Lower = easier to dismiss the sheet with a downward drag (mobile drawers). */
export const DISMISS_THRESHOLD_PX = 56
export const VELOCITY_THRESHOLD = 380
export const RUBBER_BAND_FACTOR = 0.3

/** Pixels of vertical movement before sheet drag activates (lower = easier to start dragging). */
export const BOTTOM_SHEET_DRAG_SLOP_PX = 3

/** Top inset so drawer does not cover map chrome (matches prior drawer `mt-24` intent) */
export const DRAWER_TOP_INSET_PX = 96

// Keep bottom sheet constants for backward compatibility
export const BOTTOM_SHEET_TOP_INSET_PX = DRAWER_TOP_INSET_PX