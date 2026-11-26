// Internal build entry, not a public path. Everything both engines import is
// reachable from here, so it lands in a chunk of its own instead of in the v2
// engine's chunk, where the scroll engine would pull the v2 engine in with it.
import { DrawerOverlay as _DrawerOverlay } from './components/drawer/DrawerOverlay'

export * from './components/drawer/DrawerHandle'
export * from './constants'
export * from './drawerSlotsContext'
export * from './hooks/useDrawerKeyboardSnapMobile'
export * from './hooks/useDrawerSnap'
export * from './hooks/useVisualViewport'
export * from './utils'

/** @deprecated Renders nothing in either engine; the backdrop is built in. */
export const DrawerOverlay = _DrawerOverlay
