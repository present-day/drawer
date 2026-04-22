// Main component
export { Drawer, BottomSheet } from './components/Drawer'
export type { DrawerProps, DrawerRef, BottomSheetProps, BottomSheetRef } from './components/Drawer'

// Component parts (for advanced usage)
export {
  DrawerContent,
  DrawerHandle,
  DrawerOverlay,
  DrawerScrollable,
  // Backward compatibility
  BottomSheetContent,
  BottomSheetHandle,
  BottomSheetOverlay,
  BottomSheetScrollable,
} from './components/DrawerParts'

// Context and hooks
export { useDrawerContext, useBottomSheetContext } from './context'
export type { DrawerContextValue, BottomSheetContextValue } from './context'

export { useDrawerDrag, useBottomSheetDrag } from './hooks/useDrawerDrag'
export type { UseDrawerDragOptions, UseBottomSheetDragOptions } from './hooks/useDrawerDrag'

export { useDrawerSnap, useBottomSheetSnap } from './hooks/useDrawerSnap'
export type { UseDrawerSnapArgs, UseBottomSheetSnapArgs } from './hooks/useDrawerSnap'

export { useVisualViewport } from './hooks/useVisualViewport'
export type { 
  UseVisualViewportOptions,
  UseVisualViewportResult 
} from './hooks/useVisualViewport'

export { useDrawerKeyboardSnapMobile, useBottomSheetKeyboardSnapMobile } from './hooks/useDrawerKeyboardSnapMobile'

// Types
export type {
  DrawerSizing,
  DrawerSizingPreset,
  DrawerDragEvent,
  // Backward compatibility
  BottomSheetSizing,
  BottomSheetSizingPreset,
  BottomSheetDragEvent,
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
  // Backward compatibility
  BOTTOM_SHEET_SIZING,
  BOTTOM_SHEET_TOP_INSET_PX,
  // Common constants
  SNAP_POINT,
  SPRING_CONFIG,
} from './constants'

// Utilities
export { cn, lockBody, unlockBody, getLockCount, forceUnlock } from './utils'