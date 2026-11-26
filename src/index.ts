// Re-exports only, so a bundler can skip the v2 engine's chunk when an app
// doesn't import from it. See tsup.config.ts.
export {
  cn,
  DRAWER_TOP_INSET_PX,
  DrawerHandle,
  type DrawerHandleProps,
  DrawerOverlay,
  forceUnlock,
  getLockCount,
  lockBody,
  measureIntrinsicAutoHeight,
  SNAP_POINT,
  type UseVisualViewportOptions,
  type UseVisualViewportResult,
  unlockBody,
  useDrawerKeyboardSnapMobile,
  useVisualViewport,
} from './core'
export {
  type DrawerContextValue,
  type DrawerDragEvent,
  LegacyDrawer,
  LegacyDrawerContent,
  LegacyDrawerScrollable,
  SPRING_CONFIG,
  type UseDrawerDragOptions,
  type UseDrawerSnapArgs,
  useDrawerContext,
  useDrawerDrag,
  useDrawerSnap,
} from './legacy'
export {
  Drawer,
  DrawerContent,
  type DrawerContentProps,
  DrawerScrollable,
  type DrawerScrollableProps,
} from './scroll'
export type {
  DragEndInfo,
  DragInfo,
  DrawerProps,
  DrawerRef,
  DrawerSlots,
  SnapPoint,
  ViewportInfo,
} from './types'
