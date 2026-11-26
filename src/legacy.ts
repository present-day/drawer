// The v2 motion engine, kept for drawers that rely on behavior the scroll
// engine can't match yet. A separate entry, so apps on the scroll engine don't
// ship it.
export { Drawer as LegacyDrawer } from './components/Drawer'
// The named parts are the scroll engine's; LegacyDrawer needs its own, which
// register with its measuring and drag wiring.
export { DrawerContent as LegacyDrawerContent } from './components/drawer/DrawerContent'
export { DrawerScrollable as LegacyDrawerScrollable } from './components/drawer/DrawerScrollable'
export { SPRING_CONFIG } from './constants'
export { type DrawerContextValue, useDrawerContext } from './context'
export {
  type UseDrawerDragOptions,
  useDrawerDrag,
} from './hooks/useDrawerDrag'
export { type UseDrawerSnapArgs, useDrawerSnap } from './hooks/useDrawerSnap'
export type { DrawerDragEvent } from './types'
