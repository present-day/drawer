# @present-day/drawer

A flexible and performant React drawer component with smooth animations and customizable snap points.

## Features

- 🎯 **Flexible Snap Points** - Support for fractional heights, pixel values, and preset modes
- 🎬 **Smooth Animations** - Built with Framer Motion for 60fps animations
- 📱 **Mobile Optimized** - Touch-friendly drag gestures with proper momentum
- ♿ **Accessible** - ARIA-compliant with keyboard navigation support
- 🎨 **Customizable** - Tailwind CSS classes with full style control
- 🔧 **TypeScript** - Full type safety and autocomplete support

## Installation

```bash
npm install @present-day/drawer motion
# or
yarn add @present-day/drawer motion
# or
pnpm add @present-day/drawer motion
```

## Basic Usage

```tsx
import { Drawer } from '@present-day/drawer'
import { useState } from 'react'

function App() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Drawer</button>

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Content className="p-6">
          <Drawer.Handle />
          <h2>Hello World</h2>
          <p>This is a drawer!</p>
        </Drawer.Content>
      </Drawer>
    </>
  )
}
```

## Advanced Usage with Snap Points

```tsx
import { Drawer } from '@present-day/drawer'

function AdvancedExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Drawer
      open={isOpen}
      onOpenChange={setIsOpen}
      sizing={[0.3, 0.6, 0.9]} // 30%, 60%, 90% of screen height
      defaultSnapPoint={0.6}
    >
      <Drawer.Content className="p-6">
        <Drawer.Handle />
        <Drawer.Scrollable>
          <h2>Scrollable Content</h2>
          {/* Long content here */}
        </Drawer.Scrollable>
      </Drawer.Content>
    </Drawer>
  )
}
```

## API Reference

### Drawer Props

| Prop               | Type                      | Default  | Description                       |
| ------------------ | ------------------------- | -------- | --------------------------------- |
| `open`             | `boolean`                 | -        | Controls the open state           |
| `onOpenChange`     | `(open: boolean) => void` | -        | Called when open state changes    |
| `sizing`           | `DrawerSizing`            | `'auto'` | Snap point configuration          |
| `defaultSnapPoint` | `number`                  | -        | Initial snap point                |
| `dismissible`      | `boolean`                 | `true`   | Allow dismissing by dragging down |
| `modal`            | `boolean`                 | `true`   | Show overlay and lock body scroll |

### Components

- `Drawer.Content` - Main content container
- `Drawer.Handle` - Drag handle (optional)
- `Drawer.Scrollable` - Scrollable content area
- `Drawer.Overlay` - Background overlay (auto-rendered when modal=true)

## Migration

Breaking changes: the `BottomSheet` compatibility layer and `BOTTOM_SHEET_*` names are removed. Use the `Drawer` API everywhere, and update any custom CSS or `data-*` hooks that targeted the old names.

- **Components**: `BottomSheet` → `Drawer`, `BottomSheetContent` / `Handle` / `Overlay` / `Scrollable` → the corresponding `Drawer*` exports, composed as `Drawer.Content` and `Drawer`’s other static properties.
- **Context / hooks**: `useBottomSheetContext` → `useDrawerContext`, `useBottomSheetDrag` → `useDrawerDrag`, `useBottomSheetSnap` → `useDrawerSnap`, `useBottomSheetKeyboardSnapMobile` → `useDrawerKeyboardSnapMobile`. (There is no separate `BottomSheetContext` export; the underlying context is `DrawerContext` if you need it in advanced code.)
- **Types**: all `BottomSheet*` types → the matching `Drawer*` / `*Drawer*` names (e.g. `BottomSheetProps` → `DrawerProps`, `BottomSheetRef` → `DrawerRef`, `BottomSheetSizing` → `DrawerSizing`).
- **Constants**: `BOTTOM_SHEET_SIZING` → `DRAWER_SIZING`, `BOTTOM_SHEET_TOP_INSET_PX` → `DRAWER_TOP_INSET_PX`, `BOTTOM_SHEET_CONTEXT_CONSUMER` → `DRAWER_CONTEXT_CONSUMER` (kept in source; not re-exported from the package `index` — use `Drawer` and its parts in normal use), `BOTTOM_SHEET_DRAG_SLOP_PX` → `DRAWER_DRAG_SLOP_PX` (internal tuning constant).
- **Data attributes**: `data-bottom-sheet-scroll` → `data-drawer-scroll`, `data-bottom-sheet-no-drag` → `data-drawer-no-drag`.
- **CSS custom properties** on the motion panel: `--bottom-sheet-height` → `--drawer-height`, `--bottom-sheet-progress` → `--drawer-progress`, `--bottom-sheet-available-height` → `--drawer-available-height`.

## License

MIT
