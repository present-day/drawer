import { DrawerOverlay as _DrawerOverlay } from './components/drawer/DrawerOverlay'

export {
  DrawerHandle,
  type DrawerHandleProps,
} from './components/drawer/DrawerHandle'
export {
  Drawer,
  DrawerContent,
  type DrawerContentProps,
  DrawerScrollable,
  type DrawerScrollableProps,
} from './components/scroll/Drawer'
export { DRAWER_TOP_INSET_PX, SNAP_POINT } from './constants'
export { useDrawerKeyboardSnapMobile } from './hooks/useDrawerKeyboardSnapMobile'
export { measureIntrinsicAutoHeight } from './hooks/useDrawerSnap'
export type {
  UseVisualViewportOptions,
  UseVisualViewportResult,
} from './hooks/useVisualViewport'
export { useVisualViewport } from './hooks/useVisualViewport'
export type {
  DragEndInfo,
  DragInfo,
  DrawerProps,
  DrawerRef,
  DrawerSlots,
  SnapPoint,
  ViewportInfo,
} from './types'
export { cn, forceUnlock, getLockCount, lockBody, unlockBody } from './utils'

// Declared rather than re-exported: TypeScript drops `@deprecated` from
// `export { } from`.
/** @deprecated Renders nothing in either engine; the backdrop is built in. */
export const DrawerOverlay = _DrawerOverlay
