import { useDrawerContext as _useDrawerContext } from './context'
import { useDrawerDrag as _useDrawerDrag } from './hooks/useDrawerDrag'
import { useDrawerSnap as _useDrawerSnap } from './hooks/useDrawerSnap'

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
export type { UseDrawerDragOptions } from './hooks/useDrawerDrag'
export { useDrawerKeyboardSnapMobile } from './hooks/useDrawerKeyboardSnapMobile'
export type { UseDrawerSnapArgs } from './hooks/useDrawerSnap'
export { measureIntrinsicAutoHeight } from './hooks/useDrawerSnap'
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

// Declared rather than re-exported: TypeScript drops `@deprecated` from
// `export { } from`, and tagging the originals would flag LegacyDrawer itself.
/** @deprecated `LegacyDrawer` only: the scroll engine provides no `DrawerContext`. */
export const useDrawerContext = _useDrawerContext
/** @deprecated `LegacyDrawer` only: the scroll engine drags natively. */
export const useDrawerDrag = _useDrawerDrag
/** @deprecated `LegacyDrawer` only: the scroll engine resolves its own stops. */
export const useDrawerSnap = _useDrawerSnap
