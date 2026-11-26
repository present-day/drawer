// Internal build entry, not a public path. Giving the v2 engine its own entry
// puts it in its own chunk, which a bundler can drop (with `sideEffects`) when
// an app imports only the scroll engine. See tsup.config.ts.
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

export { Drawer as LegacyDrawer } from './components/Drawer'
export { DrawerContent as LegacyDrawerContent } from './components/drawer/DrawerContent'
export { DrawerScrollable as LegacyDrawerScrollable } from './components/drawer/DrawerScrollable'

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
/** @deprecated The type of the deprecated `useDrawerContext`. */
export type DrawerContextValue = _DrawerContextValue
/** @deprecated The options of the deprecated `useDrawerDrag`. */
export type UseDrawerDragOptions = _UseDrawerDragOptions
/** @deprecated The arguments of the deprecated `useDrawerSnap`. */
export type UseDrawerSnapArgs = _UseDrawerSnapArgs
/** @deprecated No callback takes it: drag callbacks get a `MouseEvent`, `TouchEvent` or `PointerEvent`. */
export type DrawerDragEvent = _DrawerDragEvent
