// Main component: the v3 scroll engine

// v2 motion engine, kept for drawers that rely on behavior the scroll engine
// can't match yet
export { Drawer as LegacyDrawer } from './components/Drawer'
export {
  DrawerHandle,
  type DrawerHandleProps,
} from './components/drawer/DrawerHandle'
export { DrawerOverlay } from './components/drawer/DrawerOverlay'
export {
  Drawer,
  DrawerContent,
  type DrawerContentProps,
  DrawerScrollable,
  type DrawerScrollableProps,
} from './components/scroll/Drawer'
// Constants (for customization)
export {
  DRAWER_TOP_INSET_PX,
  // Common constants
  SNAP_POINT,
  SPRING_CONFIG,
} from './constants'
export type { DrawerContextValue } from './context'
// v2 context and hooks
export { useDrawerContext } from './context'
export type { UseDrawerDragOptions } from './hooks/useDrawerDrag'
export { useDrawerDrag } from './hooks/useDrawerDrag'
export { useDrawerKeyboardSnapMobile } from './hooks/useDrawerKeyboardSnapMobile'
export type { UseDrawerSnapArgs } from './hooks/useDrawerSnap'
export {
  measureIntrinsicAutoHeight,
  useDrawerSnap,
} from './hooks/useDrawerSnap'
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
  DrawerProps,
  DrawerRef,
  DrawerSlots,
  SnapPoint,
  ViewportInfo,
} from './types'
// Utilities
export { cn, forceUnlock, getLockCount, lockBody, unlockBody } from './utils'
