// Main component

export type { DrawerProps, DrawerRef } from './components/Drawer'
export { Drawer } from './components/Drawer'

// Component parts (for advanced usage)
export {
  DrawerContent,
  type DrawerContentProps,
} from './components/drawer/DrawerContent'
export {
  DrawerHandle,
  type DrawerHandleProps,
} from './components/drawer/DrawerHandle'
export { DrawerOverlay } from './components/drawer/DrawerOverlay'
export { DrawerScrollable } from './components/drawer/DrawerScrollable'
// Constants (for customization)
export {
  DRAWER_SIZING,
  DRAWER_TOP_INSET_PX,
  // Common constants
  SNAP_POINT,
  SPRING_CONFIG,
} from './constants'
export type { DrawerContextValue } from './context'
// Context and hooks
export { useDrawerContext } from './context'
export type { UseDrawerDragOptions } from './hooks/useDrawerDrag'
export { useDrawerDrag } from './hooks/useDrawerDrag'
export { useDrawerKeyboardSnapMobile } from './hooks/useDrawerKeyboardSnapMobile'
export type { UseDrawerSnapArgs } from './hooks/useDrawerSnap'
export { useDrawerSnap } from './hooks/useDrawerSnap'
export type {
  UseVisualViewportOptions,
  UseVisualViewportResult,
} from './hooks/useVisualViewport'
export { useVisualViewport } from './hooks/useVisualViewport'
// Types
export type {
  DragEndInfo,
  // Common types
  DragInfo,
  DrawerDragEvent,
  DrawerSizing,
  DrawerSizingPreset,
  DrawerSlots,
  SnapPointValue,
  ViewportInfo,
} from './types'

// Utilities
export { cn, forceUnlock, getLockCount, lockBody, unlockBody } from './utils'
