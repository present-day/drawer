import { DrawerOverlay as _DrawerOverlay } from './components/drawer/DrawerOverlay'
import { SPRING_CONFIG as _SPRING_CONFIG } from './constants'
import {
  type DrawerContextValue as _DrawerContextValue,
  useDrawerContext as _useDrawerContext,
} from './context'
import {
  type UseDrawerDragOptions as _UseDrawerDragOptions,
  useDrawerDrag as _useDrawerDrag,
} from './hooks/useDrawerDrag'
import {
  type UseDrawerSnapArgs as _UseDrawerSnapArgs,
  useDrawerSnap as _useDrawerSnap,
} from './hooks/useDrawerSnap'
import type { DrawerDragEvent as _DrawerDragEvent } from './types'

// v2 motion engine, kept for drawers that rely on behavior the scroll engine
// can't match yet
export { Drawer as LegacyDrawer } from './components/Drawer'
// The named parts are the scroll engine's; LegacyDrawer needs its own, which
// register with its measuring and drag wiring.
export { DrawerContent as LegacyDrawerContent } from './components/drawer/DrawerContent'
export {
  DrawerHandle,
  type DrawerHandleProps,
} from './components/drawer/DrawerHandle'
export { DrawerScrollable as LegacyDrawerScrollable } from './components/drawer/DrawerScrollable'
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
// `export { } from`, and tagging the originals would flag LegacyDrawer itself.
/** @deprecated `LegacyDrawer` only: the scroll engine provides no `DrawerContext`. */
export const useDrawerContext = _useDrawerContext
/** @deprecated `LegacyDrawer` only: the scroll engine drags natively. */
export const useDrawerDrag = _useDrawerDrag
/** @deprecated `LegacyDrawer` only: the scroll engine resolves its own stops. */
export const useDrawerSnap = _useDrawerSnap
/** @deprecated `LegacyDrawer` only: the scroll engine has no spring. */
export const SPRING_CONFIG = _SPRING_CONFIG
/** @deprecated Renders nothing in either engine; the backdrop is built in. */
export const DrawerOverlay = _DrawerOverlay
/** @deprecated The type of the deprecated `useDrawerContext`. */
export type DrawerContextValue = _DrawerContextValue
/** @deprecated The options of the deprecated `useDrawerDrag`. */
export type UseDrawerDragOptions = _UseDrawerDragOptions
/** @deprecated The arguments of the deprecated `useDrawerSnap`. */
export type UseDrawerSnapArgs = _UseDrawerSnapArgs
/** @deprecated No callback takes it: drag callbacks get a `MouseEvent`, `TouchEvent` or `PointerEvent`. */
export type DrawerDragEvent = _DrawerDragEvent
