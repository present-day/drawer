// Main component
export { Drawer } from './components/Drawer'
export type { DrawerProps, DrawerRef } from './components/Drawer'

// Component parts (for advanced usage)
export {
  DrawerContent,
  DrawerHandle,
  DrawerOverlay,
  DrawerScrollable,
  type DrawerContentProps,
  type DrawerHandleProps,
} from './components/DrawerParts'

// Context and hooks
export { useDrawerContext } from './context'
export type { DrawerContextValue } from './context'

export { useDrawerDrag } from './hooks/useDrawerDrag'
export type { UseDrawerDragOptions } from './hooks/useDrawerDrag'

export { useDrawerSnap } from './hooks/useDrawerSnap'
export type { UseDrawerSnapArgs } from './hooks/useDrawerSnap'

export { useVisualViewport } from './hooks/useVisualViewport'
export type {
  UseVisualViewportOptions,
  UseVisualViewportResult,
} from './hooks/useVisualViewport'

export { useDrawerKeyboardSnapMobile } from './hooks/useDrawerKeyboardSnapMobile'

// Types
export type {
  DrawerSizing,
  DrawerSizingPreset,
  DrawerDragEvent,
  DrawerSlots,
  // Common types
  DragInfo,
  DragEndInfo,
  SnapPointValue,
  ViewportInfo,
} from './types'

// Constants (for customization)
export {
  DRAWER_SIZING,
  DRAWER_TOP_INSET_PX,
  // Common constants
  SNAP_POINT,
  SPRING_CONFIG,
} from './constants'

// Utilities
export { cn, lockBody, unlockBody, getLockCount, forceUnlock } from './utils'
