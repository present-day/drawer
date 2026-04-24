# @present-day/drawer

A flexible and performant React drawer component with smooth animations and customizable snap points.

## Features

- 🎯 **Flexible Snap Points** - Support for fractional heights, pixel values, and preset modes
- 🎬 **Smooth Animations** - Built with Framer Motion for 60fps animations
- 📱 **Mobile Optimized** - Touch-friendly drag gestures with proper momentum
- ♿ **Accessible** - `role="dialog"`, `aria-modal`, name/description, focus trap, and Escape to dismiss
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

## Accessibility

The panel is exposed as a **`role="dialog"`** with **`aria-modal="true"`** when `modal` is true (the default for modal overlay + body scroll lock).

**Name and description (recommended for all modal drawers, similar to Radix Dialog):**

- **`title`** and **`description`** – Rendered in a **screen-reader-only** block (`sr-only`); the dialog is wired with `aria-labelledby` and `aria-describedby` so assistive technology gets a clear name and optional description even when you do not show a visible heading in the header chrome.
- **`ariaLabel`** – Use when you do not pass `title` but still need a short accessible name (e.g. `ariaLabel="Filters"`).

**Focus**

- For **`modal` + `open`**, a **focus trap** keeps keyboard focus in the panel by default, with focus returned to the previously focused element on close. Set **`focusTrap={false}`** if you need to manage focus yourself (e.g. portaled sub-trees) or for non-modal behavior.
- Clicks on the **backdrop** still work: outside clicks that dismiss are allowed; Escape closes the drawer when **`dismissible`** is true.

**Example: hidden title and description (visual UI unchanged)**

```tsx
<Drawer
  open={open}
  onOpenChange={setOpen}
  title="Account settings"
  description="Update your email and password."
>
  <Drawer.Content … />
</Drawer>
```

## Theming and chrome

**Merge order** for surface classes: internal defaults → `Drawer`’s `slots` (`contentClassName`, `handleClassName`, `handleIndicatorClassName`) → each part’s own `className` (and `Drawer.Handle`’s `indicatorClassName` for the default bar only).

**`data-*` attributes** (stable hooks for CSS):

| Attribute                     | Element                                      |
| ----------------------------- | -------------------------------------------- |
| `data-drawer-content`         | `Drawer.Content` root                        |
| `data-drawer-handle`          | `Drawer.Handle` track                        |
| `data-drawer-handle-indicator`| Default handle bar (`span`)                  |
| `data-drawer-scroll`          | `Drawer.Scrollable` root                     |
| `data-drawer-no-drag`         | Opt out of panel drag (buttons, inputs, etc.) |

**`Drawer.Handle`:** use `indicatorClassName` to style the default pill without `[&>span]:…`. Pass `children` to replace the default bar entirely.

**Overlay:** when `modal` is true, pass `overlayClassName` on `Drawer` to extend or override the default dimmer (`bg-black/50`), e.g. translucent or stronger scrims.

### Example: slots + overlay

```tsx
<Drawer
  open={open}
  onOpenChange={setOpen}
  overlayClassName="bg-black/30 backdrop-blur-sm"
  slots={{
    contentClassName: 'bg-zinc-900 text-white',
    handleIndicatorClassName: 'bg-white/30',
  }}
>
  <Drawer.Content className="p-6">
    <Drawer.Handle />
    …
  </Drawer.Content>
</Drawer>
```

### Product app (wrapper) checklist

This package does not include app-specific chrome (e.g. big close buttons). After upgrading to **1.1.0+**:

1. Wrap or re-export `Drawer` from one module (e.g. `shared/drawers/drawer`) and add optional **context** for app-wide defaults merged with `cn` into `slots`, `overlayClassName`, and per-drawer overrides.
2. Map **`default` / `overlay` / `translucent`** (or similar) to preset `slots` + `overlayClassName` values; merge explicit overrides on top with `cn`, do not replace entire presets unless intentional.
3. Document in the wrapper’s JSDoc which props are **forwarded** to `@present-day/drawer` vs **app-only** (close UI, variants, stripped legacy props).
4. Enforce a **single import path** for product code (ESLint `no-restricted-imports` or a codemod from legacy `ui/drawer`).
5. Add a short **“Drawer recipes”** comment block at the top of the wrapper file for agents (default sheet, overlay, translucent, custom chrome, custom close).

### Mobile Safari, soft keyboard, and the visual viewport

When the drawer is **open**, it listens to `window.visualViewport` (`resize` and `scroll`). Snap heights and `--drawer-available-height` use the **visual** viewport height. The panel is `position: fixed` with an extra **`bottom` offset** so its bottom edge follows the **visual** viewport, not only the **layout** viewport. That avoids the common iOS case where a fixed `bottom: 0` sheet stays behind the on-screen keyboard even though heights were already keyboard-aware. The offset is exposed as `layoutBottomInset` on the [`ViewportInfo`](./src/types.ts) object: `max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)`.

**Optional** [`useDrawerKeyboardSnapMobile`](./src/hooks/useDrawerKeyboardSnapMobile.ts) (re-exported from the package) can be wired to **`onViewportChange`** to snap the sheet to its maximum height when a soft keyboard is detected on mobile, then restore the previous snap when the keyboard hides. That is **separate** from the built-in bottom anchoring: you do not need the hook for the sheet to sit above the keyboard, but the hook is useful if you want the sheet to expand for text fields in partial-height modes.

**CSS** on the motion panel: in addition to `--drawer-height`, `--drawer-progress`, and `--drawer-available-height`, the panel sets **`--drawer-layout-bottom-inset`** (same value as the inline `bottom` used for anchoring).

## API Reference

### Drawer Props

| Prop               | Type                      | Default  | Description                       |
| ------------------ | ------------------------- | -------- | --------------------------------- |
| `open`             | `boolean`                 | -        | Controls the open state           |
| `onOpenChange`     | `(open: boolean) => void` | -        | Called when open state changes    |
| `sizing`           | `DrawerSizing`            | `'auto'` | Snap point configuration          |
| `defaultSnapPoint` | `number`                  | -        | Initial snap point                |
| `dismissible`      | `boolean`                 | `true`   | Allow dismissing by dragging down; Escape closes when true |
| `modal`            | `boolean`                 | `true`   | Show overlay and lock body scroll |
| `focusTrap`        | `boolean`                 | `true`   | When `modal`, trap keyboard focus in the panel; set `false` to opt out |
| `title`            | `ReactNode`               | -        | Screen-reader title (`aria-labelledby`); use for accessible name if you have no visible title |
| `description`     | `ReactNode`               | -        | Optional; `aria-describedby`      |
| `ariaLabel`        | `string`                  | -        | Alternative accessible name if `title` is omitted |
| `overlayClassName` | `string`                  | -        | Merged with default modal overlay |
| `slots`            | `DrawerSlots`             | -        | Optional class names for content / handle |
| `topInsetPx`      | `number`                  | map inset | Pixels subtracted from visual height for snap math |
| `onViewportChange` | `(viewport: ViewportInfo) => void` | - | Fired when the visual viewport updates while open; includes `layoutBottomInset`, `height`, `offsetTop`, `keyboardHeight`, `isKeyboardOpen` |

### Components

- `Drawer.Content` - Main content container (`data-drawer-content`)
- `Drawer.Handle` - Drag handle (optional); supports `indicatorClassName` and `children`
- `Drawer.Scrollable` - Scrollable content area
- `Drawer.Overlay` - Background overlay (auto-rendered when modal=true)

## Migration

Breaking changes: the `BottomSheet` compatibility layer and `BOTTOM_SHEET_*` names are removed. Use the `Drawer` API everywhere, and update any custom CSS or `data-*` hooks that targeted the old names.

- **Components**: `BottomSheet` → `Drawer`, `BottomSheetContent` / `Handle` / `Overlay` / `Scrollable` → the corresponding `Drawer*` exports, composed as `Drawer.Content` and `Drawer`’s other static properties.
- **Context / hooks**: `useBottomSheetContext` → `useDrawerContext`, `useBottomSheetDrag` → `useDrawerDrag`, `useBottomSheetSnap` → `useDrawerSnap`, `useBottomSheetKeyboardSnapMobile` → `useDrawerKeyboardSnapMobile`. (There is no separate `BottomSheetContext` export; the underlying context is `DrawerContext` if you need it in advanced code.)
- **Types**: all `BottomSheet*` types → the matching `Drawer*` / `*Drawer*` names (e.g. `BottomSheetProps` → `DrawerProps`, `BottomSheetRef` → `DrawerRef`, `BottomSheetSizing` → `DrawerSizing`).
- **Constants**: `BOTTOM_SHEET_SIZING` → `DRAWER_SIZING`, `BOTTOM_SHEET_TOP_INSET_PX` → `DRAWER_TOP_INSET_PX`, `BOTTOM_SHEET_CONTEXT_CONSUMER` → `DRAWER_CONTEXT_CONSUMER` (kept in source; not re-exported from the package `index` — use `Drawer` and its parts in normal use), `BOTTOM_SHEET_DRAG_SLOP_PX` → `DRAWER_DRAG_SLOP_PX` (internal tuning constant).
- **Data attributes**: `data-bottom-sheet-scroll` → `data-drawer-scroll`, `data-bottom-sheet-no-drag` → `data-drawer-no-drag`.
- **CSS custom properties** on the motion panel: `--bottom-sheet-height` → `--drawer-height`, `--bottom-sheet-progress` → `--drawer-progress`, `--bottom-sheet-available-height` → `--drawer-available-height`. New: `--drawer-layout-bottom-inset` (visual-viewport bottom anchoring; see *Mobile Safari, soft keyboard* above).

## License

MIT
