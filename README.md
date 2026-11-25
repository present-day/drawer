# @present-day/drawer

A flexible and performant React drawer component with smooth animations and customizable snap points.

**[▶ Try it in Storybook](https://present-day.github.io/drawer/)**

## Features

- 🎯 **Flexible Snap Points** - Support for fractional heights, pixel values, and preset modes
- 🎬 **Smooth Animations** - Native scroll snapping, so swipes run on the compositor; the v2 motion engine stays available as `LegacyDrawer`
- 📱 **Mobile Optimized** - Touch-friendly drag gestures with proper momentum
- ♿ **Accessible** - `role="dialog"`, `aria-modal`, name/description, focus trap, and Escape to dismiss
- 🎨 **Customizable** - Tailwind CSS classes with full style control
- 🔧 **TypeScript** - Full type safety and autocomplete support

## Installation

```bash
bun add @present-day/drawer motion
# or
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
      snapPoints={[0.3, 0.6, 0.9]} // 30%, 60%, 90% of screen height
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

- For **`modal` + `open`**, a **focus trap** keeps keyboard focus in the panel by default, with focus returned to the previously focused element on close. Set **`focusTrap={false}`** if you need to manage focus yourself (e.g. portaled sub-trees) or for non-modal behavior. Without the trap, the v3 `Drawer` still moves focus into a modal sheet when it opens and, on close, returns it to the element that had it (if still in the page), else to the drawer below, else the body. Focus the user has moved elsewhere is left alone.
- Clicks on the **backdrop** still work: outside clicks that dismiss are allowed; Escape closes the drawer when **`dismissible`** is true. On the v3 `Drawer`, Escape goes to the topmost open modal drawer wherever focus is, and does nothing if that drawer isn't dismissible; a modeless drawer hears Escape only from inside it. Inside a **non-empty** text field, Escape clears the field first and only a second press dismisses (see *Escape behavior in editable fields*).

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

**`data-*` attributes** (stable hooks for CSS). `data-drawer-*` names the parts and the opt-ins you set; `data-scroll-drawer-*` is set by the v3 engine:

| Attribute                       | Element                                      |
| ------------------------------- | -------------------------------------------- |
| `data-drawer-content`           | `Drawer.Content` root                        |
| `data-drawer-handle`            | `Drawer.Handle` track                        |
| `data-drawer-handle-indicator`  | Default handle bar (`span`)                  |
| `data-drawer-scroll`            | `Drawer.Scrollable` root                     |
| `data-drawer-no-drag`           | Set it to opt an element out of drags (fields always are) |
| `data-drawer-drag`              | Set it to let a mouse drag start on a button or link inside it (v3) |
| `data-scroll-drawer-root`       | The drawer's outermost element (v3)          |
| `data-scroll-drawer-stacked`    | On the root while the drawer is stacked above another `stack` drawer (v3) |
| `data-scroll-drawer-pinned`     | On the root when `dismissible={false}` (v3)  |
| `data-scroll-drawer-sheet`      | The sheet, which carries `role="dialog"` (v3) |
| `data-scroll-drawer-backdrop`   | The modal backdrop (v3)                      |
| `data-scroll-drawer-keyboard`   | On the scroller while the soft keyboard is up (v3) |
| `data-scroll-drawer-dragging`   | On the scroller during a mouse or modeless touch drag (v3) |

The public v3 CSS variables are `--scroll-drawer-stack-scale`, `--scroll-drawer-stack-shift`, `--scroll-drawer-backdrop-min`, `--scroll-drawer-backdrop-max` and `--scroll-drawer-fill` (see *Stacking*). Other `data-scroll-drawer-*` attributes and `--scroll-drawer-*` variables are internal and may change in a minor release. `--drawer-*` variables are `LegacyDrawer`'s.

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

> This section describes `LegacyDrawer`. The v3 `Drawer` resolves snap points to px when it opens and when its scroller resizes, and the soft keyboard doesn't re-resolve them. While the keyboard is up, its scroller shrinks to the visual viewport and the sheet rides up by the keyboard height (never past `topInsetPx`, or the top safe-area inset for a drawer with a `'screen'` stop), with its surface painted on behind the keyboard, then returns to its stop when the keyboard hides. `'auto'` content doesn't shrink while the keyboard is up, there is no iOS glide, and `onViewportChange` is still reported. `useDrawerKeyboardSnapMobile` works with both engines.

When the drawer is **open**, it listens to `window.visualViewport` (`resize` and `scroll`). Snap heights and `--drawer-available-height` use the **visual** viewport height. The panel is `position: fixed` with an extra **`bottom` offset** so its bottom edge follows the **visual** viewport, not only the **layout** viewport. That avoids the common iOS case where a fixed `bottom: 0` sheet stays behind the on-screen keyboard even though heights were already keyboard-aware. The offset is exposed as `layoutBottomInset` on the [`ViewportInfo`](./src/types.ts) object: `max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)`.

The keyboard transition is kept stable by three behaviors (v2.2+):

- The **`bottom` offset is animated** with the same spring as the height, so the panel rises smoothly above the keyboard instead of teleporting up while the height spring lags.
- An **instant `max-height` clamp** (visual viewport height minus `topInsetPx`) is applied on the same render that observes the new viewport, so the panel top can never overshoot out of the visible viewport while springs settle.
- While the keyboard is open **and focus is inside the panel**, `'auto'` snap heights will not **shrink** below the current height. Clearing a search query often unmounts the results for a moment; without the floor, the sheet collapses mid-typing and the next tap lands on the dismiss overlay. Growth still passes through, and the floor releases when the keyboard hides. Transient **zero** content measurements are ignored while open for the same reason.

**Optional** [`useDrawerKeyboardSnapMobile`](./src/hooks/useDrawerKeyboardSnapMobile.ts) (re-exported from the package) can be wired to **`onViewportChange`** to snap the sheet to its maximum height when a soft keyboard is detected on mobile, then restore the previous snap when the keyboard hides. That is **separate** from the built-in bottom anchoring: you do not need the hook for the sheet to sit above the keyboard, but the hook is useful if you want the sheet to expand for text fields in partial-height modes.

**CSS** on the motion panel: in addition to `--drawer-height`, `--drawer-progress`, and `--drawer-available-height`, the panel sets **`--drawer-layout-bottom-inset`** (same value as the animated `bottom` target used for anchoring) and **`--drawer-safe-area-bottom`** (see below).

### Safe-area insets

> On the v3 `Drawer` the inset is applied the same way, but `--drawer-safe-area-bottom` is set only by `LegacyDrawer`.

By default the panel is padded with **`env(safe-area-inset-bottom, 0px)`** so content clears the home indicator, and `'auto'` snap heights **grow by the resolved inset** so the padding doesn't squeeze measured content. Control it with the **`safeAreaBottom`** prop: pass a **number** for an explicit pixel inset, or **`false`** to opt out when your app already pads its drawer content. The active inset is exposed on the panel as **`--drawer-safe-area-bottom`**. The default **`topInsetPx`** (96px) keeps the sheet clear of the top notch/safe area.

### Escape behavior in editable fields

Pressing **Escape** inside a **non-empty** `input`, `textarea`, or `contenteditable` does **not** dismiss the drawer — the field clears first (the browser's native `type="search"` behavior), and a **second** Escape on the now-empty field dismisses. The drawer also ignores Escape events whose default was prevented, so apps can claim Escape for their own shortcuts.

### Scrollbar in `Drawer.Scrollable`

In the v3 `Drawer`, `Drawer.Scrollable` is `overflow: hidden` until the sheet reaches the stop that unlocks it (`contentScroll`, `contentScrollFrom`), and `overflow-y: auto` from there. Those rules sit inside `:where()`, so an unlayered overflow class on its `className` wins: `overflow-y-auto` there unlocks it at every stop and defeats `contentScroll="top"`, so leave overflow to the engine. The engine's rules are unlayered, so they beat any cascade layer, including Tailwind v4's `@layer utilities`; to override them from a layer, use the important modifier (`overflow-y-auto!`). On `LegacyDrawer` it is a plain `overflow-y-auto` container.

In both engines it **reserves no scrollbar gutter** and does **not** hide the scrollbar. There is intentionally no prop for either; style the scrollbar through the part's `className` (merged with **tailwind-merge** when installed) or `style`. On **classic, space-taking scrollbars** (Windows, Linux, or macOS set to always show scrollbars), content width **shrinks** once the list overflows. **Overlay-scrollbar platforms** (default macOS, iOS, Android) are unaffected.

```tsx
<Drawer.Scrollable
  // Reserve the gutter so content width stays constant
  className="[scrollbar-gutter:stable]"
  // Or hide the scrollbar but keep scrolling
  // className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  // Without Tailwind
  // style={{ scrollbarGutter: 'stable' }}
>
  {/* long content */}
</Drawer.Scrollable>
```

Hiding the scrollbar removes a visible scroll affordance for mouse users, so prefer the gutter unless the design signals scrollability another way.

## API Reference

### Drawer Props

| Prop                  | Type                                              | Default    | Description                       |
| --------------------- | ------------------------------------------------- | ---------- | --------------------------------- |
| `open`                | `boolean`                                         | -          | Controls the open state           |
| `onOpenChange`        | `(open: boolean) => void`                         | -          | Called when open state changes    |
| `snapPoints`          | `SnapPoint[]`                                     | `['auto']` | Snap stops; each entry is a fraction (`≤ 1`), pixel value (`> 1`), `'auto'`, `'full'`, or `'screen'` |
| `defaultSnapPoint`    | `SnapPoint`                                       | last stop  | Initial snap point                |
| `activeSnapPoint`     | `SnapPoint`                                       | -          | Controlled active snap            |
| `onSnapPointChange`   | `(point: SnapPoint, index: number) => void`       | -          | Called when the active snap changes (drag, ref controls, programmatic); the `index` is provided as a convenience |
| `dismissible`         | `boolean`                                         | `true`     | Allow dismissing by dragging down; Escape closes when true |
| `modal`               | `boolean`                                         | `true`     | Show overlay and lock body scroll |
| `focusTrap`           | `boolean`                                         | `true`     | When `modal`, trap keyboard focus in the panel; set `false` to opt out |
| `title`               | `ReactNode`                                       | -          | Screen-reader title (`aria-labelledby`); use for accessible name if you have no visible title |
| `description`         | `ReactNode`                                       | -          | Optional; `aria-describedby`      |
| `ariaLabel`           | `string`                                          | -          | Alternative accessible name if `title` is omitted |
| `overlayClassName`    | `string`                                          | -          | Merged with default modal overlay |
| `slots`               | `DrawerSlots`                                     | -          | Optional class names for content / handle |
| `topInsetPx`          | `number`                                          | `96`       | Px kept clear above `'full'` and fractional stops (`LegacyDrawer`: subtracted from the visual viewport height) |
| `safeAreaBottom`      | `boolean \| number`                               | `true`     | Bottom safe-area padding: `true` uses `env(safe-area-inset-bottom)`, a number forces pixels, `false` opts out |
| `onViewportChange`    | `(viewport: ViewportInfo) => void`                | -          | Fired when the visual viewport updates while open; includes `layoutBottomInset`, `height`, `offsetTop`, `keyboardHeight`, `isKeyboardOpen` |
| `contentScroll`       | `'top' \| 'always'`                               | `'top'`    | `'top'`: `Drawer.Scrollable` scrolls only at the top stop (or `contentScrollFrom`); below it a swipe moves the sheet. `'always'`: it scrolls at every stop |
| `contentScrollFrom`   | `SnapPoint`                                       | top stop   | With `contentScroll="top"`, the lowest stop at which `Drawer.Scrollable` scrolls |
| `onHeightChange`      | `(height: number) => void`                        | -          | Visible sheet height in px, at most once per frame while it moves; costs no layout |
| `stack`               | `boolean`                                         | `false`    | While another `stack` drawer is open on top, this one recedes (see *Stacking*) |

`modal={false}` renders no backdrop, scroll lock, or focus trap, and the page behind stays usable. `nested` is ignored by the v3 `Drawer`.

### Stacking

Set `stack` on each drawer that should recede when another opens above it. The drawer behind scales and shifts with the top drawer's swipe, and a drawer stacked above another dims the page less so backdrops don't compound to black. Each CSS variable is read in one place; set it there or on an ancestor it inherits from:

| Variable                       | Default                                | Read on                                                                 |
| ------------------------------ | -------------------------------------- | ----------------------------------------------------------------------- |
| `--scroll-drawer-stack-scale`  | `0.92`                                 | Scroller of the drawer that recedes (its root, or `:root` for all)       |
| `--scroll-drawer-stack-shift`  | `-8px`                                 | Same as above                                                           |
| `--scroll-drawer-backdrop-max` | `1` (`0.3` when stacked above another) | The drawer's own backdrop; the `0.3` is set on the stacked drawer's root, so an ancestor value doesn't reach it. Override with `overlayClassName="[--scroll-drawer-backdrop-max:0.2]"` |
| `--scroll-drawer-backdrop-min` | `0` (`0.4` when `dismissible={false}`) | The drawer's own backdrop, overridden the same way                       |
| `--scroll-drawer-fill` | the content's background | Set on `Drawer.Content` when its surface is painted by a child, so the strip below the resting layout isn't transparent mid-drag, and the area behind the translucent iOS keyboard shows the sheet |

### Dragging

Touch pans a modal sheet natively, except that a vertical pan can't start on `[data-drawer-no-drag]` (it gets `touch-action: pan-x pinch-zoom`). On a modeless sheet (`modal={false}`) touch is driven in JavaScript, because iOS won't pan a scroller that lets taps through to the page: it drags from anywhere, buttons and links included, except fields and `[data-drawer-no-drag]`; sideways swipes and a list that can scroll that way stay native, and a tap still taps. A mouse drags it from anywhere except buttons and links, unless they sit inside `[data-drawer-drag]`, and never from fields or `[data-drawer-no-drag]`. Mostly sideways drags are left to horizontal scrollers, and a plain click still clicks.

### Components

- `Drawer.Content` - Main content container (`data-drawer-content`)
- `Drawer.Handle` - Drag handle (optional); supports `indicatorClassName` and `children`
- `Drawer.Scrollable` - Scrollable content area; see `contentScroll`
- `Drawer.Overlay` - Deprecated; renders nothing. The backdrop is built in when `modal`; style it with `overlayClassName`
- `LegacyDrawer` - The v2 motion engine, same props as `Drawer` without the scroll-engine-only props. Use its own parts: `LegacyDrawer.Content` and `LegacyDrawer.Scrollable`, or the named `LegacyDrawerContent` and `LegacyDrawerScrollable`

## Migration

### v2 → v3

`Drawer` now runs on native scroll snapping with the v2 props, ref, and parts. Behavior differences (`nested` ignored, snap points resolved when the drawer opens, the keyboard ride-up, `onDragEnd` at settle, no `--drawer-*` variables, the v2 hooks being `LegacyDrawer` only) and the new props are listed in [`MIGRATION.md`](./MIGRATION.md). To keep the v2 engine, change the import, and the named parts if you use them:

```tsx
import {
  LegacyDrawer as Drawer,
  LegacyDrawerContent as DrawerContent,
  LegacyDrawerScrollable as DrawerScrollable,
} from '@present-day/drawer'
```

### v1 → v2

The `sizing` prop and `DRAWER_SIZING` constant are removed in favor of a single, array-shaped `snapPoints` prop that aligns with [Vaul](https://vaul.emilkowal.ski) and [shadcn drawer](https://ui.shadcn.com/docs/components/drawer). See [`MIGRATION.md`](./MIGRATION.md) for a full diff and codemod-friendly find/replace list.

Quick summary:

- `sizing="auto"` → omit (now the default) or pass `snapPoints={['auto']}`
- `sizing="full"` → `snapPoints={['full']}`
- `sizing={[…]}` → `snapPoints={[…]}`
- `SnapPointValue` type → `SnapPoint`
- `DrawerSizing` / `DrawerSizingPreset` types removed
- `SNAP_POINT.FULL` (was `0.9`) → either `SNAP_POINT.NEAR_FULL` (the same `0.9` value) or `SNAP_POINT.MAX` (`1`, full height). The new `SNAP_POINT.FULL` token resolves to `'full'`.

### Earlier: BottomSheet → Drawer

The `BottomSheet` compatibility layer and `BOTTOM_SHEET_*` names were removed in v1. Use the `Drawer` API everywhere, and update any custom CSS or `data-*` hooks that targeted the old names.

- **Components**: `BottomSheet` → `Drawer`, `BottomSheetContent` / `Handle` / `Overlay` / `Scrollable` → the corresponding `Drawer*` exports, composed as `Drawer.Content` and `Drawer`’s other static properties.
- **Context / hooks** (all but `useDrawerKeyboardSnapMobile` are `LegacyDrawer` only as of v3): `useBottomSheetContext` → `useDrawerContext`, `useBottomSheetDrag` → `useDrawerDrag`, `useBottomSheetSnap` → `useDrawerSnap`, `useBottomSheetKeyboardSnapMobile` → `useDrawerKeyboardSnapMobile`. (There is no separate `BottomSheetContext` export; the underlying context is `DrawerContext` if you need it in advanced code.)
- **Types**: all `BottomSheet*` types → the matching `Drawer*` / `*Drawer*` names (e.g. `BottomSheetProps` → `DrawerProps`, `BottomSheetRef` → `DrawerRef`).
- **Constants**: `BOTTOM_SHEET_TOP_INSET_PX` → `DRAWER_TOP_INSET_PX`, `BOTTOM_SHEET_CONTEXT_CONSUMER` → `DRAWER_CONTEXT_CONSUMER` (kept in source; not re-exported from the package `index` — use `Drawer` and its parts in normal use), `BOTTOM_SHEET_DRAG_SLOP_PX` → `DRAWER_DRAG_SLOP_PX` (internal tuning constant).
- **Data attributes**: `data-bottom-sheet-scroll` → `data-drawer-scroll`, `data-bottom-sheet-no-drag` → `data-drawer-no-drag`.
- **CSS custom properties** on the motion panel: `--bottom-sheet-height` → `--drawer-height`, `--bottom-sheet-progress` → `--drawer-progress`, `--bottom-sheet-available-height` → `--drawer-available-height`. New: `--drawer-layout-bottom-inset` (visual-viewport bottom anchoring; see *Mobile Safari, soft keyboard* above).

## Development

```bash
bun run storybook   # http://localhost:6006 (toolbar: Theme)
bun run test
bun run build
bun run demo:build   # demo/dist, an on-device frame-rate comparison of Drawer and LegacyDrawer
```

**Testing on a phone:** The drawer portals to `document.body` and positions itself with `position: fixed` against `window.visualViewport`, so the Storybook manager UI (which renders stories in an iframe inside its own chrome) does not reproduce real mobile behavior such as the soft keyboard. Instead, open a story's standalone URL, `iframe.html?id=<story-id>`, on the phone (for example, https://present-day.github.io/drawer/iframe.html?id=drawer--auto-search-keyboard). Stories open the drawer on load and render an in-page event log, and story IDs are shown in the Storybook URL as `?path=/story/<story-id>`.

## License

MIT
