# Migration

## v3 → v4

The v2 motion engine moved from the package root to its own entry,
`@present-day/drawer/legacy`, so apps that only use the scroll engine no longer
bundle it. Change the import of `LegacyDrawer`, `LegacyDrawerContent`,
`LegacyDrawerScrollable`, `useDrawerContext`, `useDrawerDrag`, `useDrawerSnap`,
`SPRING_CONFIG`, `DrawerContextValue`, `UseDrawerDragOptions`,
`UseDrawerSnapArgs` and `DrawerDragEvent`:

```tsx
import { LegacyDrawer } from '@present-day/drawer/legacy'
```

Their behavior is unchanged, and they are no longer marked deprecated there.
Body locks stay shared, so `lockBody` from the root counts the locks either
engine takes.

## v2 → v3

v3 swaps the default `Drawer` to a native scroll-snap engine: the sheet is a
scroll container, so a swipe runs on the compositor instead of a JavaScript
animation loop. The props, ref, and part names (`Drawer.Content`,
`Drawer.Handle`, `Drawer.Scrollable`) are the v2 ones. The v2 motion engine is
still exported as `LegacyDrawer` (from `@present-day/drawer/legacy` as of v4).

### Breaking

- **`Drawer` is the scroll engine.** Anything that relied on the motion
  engine's spring or its internals can move to `LegacyDrawer` (below).
- **`nested` is ignored.** A drawer's gestures are scoped by its own scroll
  container, so nesting needs no flag.
- **Escape closes the topmost open modal drawer**, wherever focus is, and
  nothing if that drawer isn't dismissible. In v2 it closed the drawer whose
  panel had focus. A modeless drawer still hears Escape only from inside it.
- **Focus moves without the trap.** With `focusTrap={false}`, a modal sheet
  still takes focus when it opens and, on close, hands it back to the element
  that had it, else to the drawer below, else the body. v2 left focus alone.
- **Snap points resolve to px when the drawer opens, and again when the
  scroller resizes** (rotation, browser chrome). The soft keyboard doesn't
  re-resolve them: while it is up, the scroller shrinks to the visual viewport
  and the sheet rides up by the keyboard height, never past `topInsetPx` (the
  top safe-area inset for a drawer with a `'screen'` stop), with its surface
  painted on behind the translucent keyboard, and it returns to its stop when
  the keyboard hides. `'auto'` content can grow while the keyboard is up but
  doesn't shrink until it hides.
- **No keyboard glide on iOS.** `LegacyDrawer` eases the sheet up when iOS
  reports the keyboard in one late jump; the scroll engine moves it in one
  step.
- **`'screen'` resolves against the scroller**, so it honors `bottomInsetPx`.
  `LegacyDrawer` resolves it to the whole viewport.
- **`onDragEnd` fires when the sheet settles**, after momentum, rather than at
  release. Its `y` and `velocity` are frozen at release, as in v2. A drag
  that dismisses the sheet ends with `targetSnapPoint: 0`; v2 fired no
  `onDragEnd` for it.
- **`onDrag` keeps firing during momentum** after the finger lifts, until the
  sheet settles.
- **`useDrawerContext`, `useDrawerDrag`, and `useDrawerSnap` are
  `LegacyDrawer` only** and deprecated. The scroll engine provides no
  `DrawerContext`, so `useDrawerContext` throws inside it.
  `useDrawerKeyboardSnapMobile` works with both.
- **The `--drawer-*` CSS variables on the panel exist only on `LegacyDrawer`.**
  The scroll engine does not set `--drawer-height`, `--drawer-progress`,
  `--drawer-available-height`, `--drawer-layout-bottom-inset`, or
  `--drawer-safe-area-bottom`. Use `onHeightChange` to follow the sheet.
- **The named `DrawerContent` and `DrawerScrollable` exports are the scroll
  engine's parts.** They don't work inside `LegacyDrawer`, and v2's parts don't
  work inside `Drawer`. `LegacyDrawer` users switch to `LegacyDrawerContent`
  and `LegacyDrawerScrollable`, or `LegacyDrawer.Content` and
  `LegacyDrawer.Scrollable`.
- **`useVisualViewport` reads the keyboard differently**, and `LegacyDrawer`
  and `onViewportChange` see it too. On a touch screen with a text field
  focused, `keyboardHeight` is measured from the tallest layout height seen at
  the current width, not only from `innerHeight`, because iOS can shrink
  `innerHeight` with the keyboard and pan the page instead. It is also
  re-evaluated on `focusin` and `focusout`.
- **The scroll engine injects its own `<style>` element** into `document.head`
  on first open. A Content Security Policy whose `style-src` lacks
  `'unsafe-inline'` blocks it, and the drawer then doesn't lay out.
- **`Drawer.Overlay` / `DrawerOverlay`, `SPRING_CONFIG`, `DrawerDragEvent`,
  the `nested` prop, and the types of the v2 hooks are deprecated.** Overlay
  never rendered anything in v3; the rest are `LegacyDrawer` only.
- **Mouse drags** work as in v2 (from anywhere on the sheet), except from
  buttons and links unless they sit inside `[data-drawer-drag]`, and never from
  fields or `[data-drawer-no-drag]`. A mostly sideways mouse drag is left to
  whatever scrolls horizontally there.

### New

| Prop | What it does |
| ---- | ------------ |
| `contentScroll` | `'top'` (default): `Drawer.Scrollable` scrolls once the sheet is at its top stop (or `contentScrollFrom`); below that a swipe on it moves the sheet. `'always'`: it scrolls at every stop, and the sheet moves from the handle and other chrome or when the list's scroll chains at its top. |
| `contentScrollFrom` | With `contentScroll="top"`, the lowest stop at which `Drawer.Scrollable` scrolls. Defaults to the top stop. Set it when the top stop is one users don't rest at, such as a full-screen stop added for the keyboard. |
| `onHeightChange` | Visible sheet height in px, at most once per frame while it moves. Read from `scrollTop`, so it costs no layout. A `ResizeObserver` on the sheet never fires, because the sheet scrolls rather than resizes. |
| `stack` | Opt-in stacking. While another `stack` drawer is open on top, this one recedes, and once more per further drawer above it. |

```tsx
<Drawer snapPoints={['auto', 'full']} contentScrollFrom="full" onHeightChange={setSheetHeight}>
  <Drawer.Content>
    <Drawer.Handle />
    <Drawer.Scrollable>{/* long list */}</Drawer.Scrollable>
  </Drawer.Content>
</Drawer>
```

**`modal={false}`** renders no backdrop, locks no scroll, and traps no focus;
the page behind stays usable, while the sheet itself still drags and snaps.
On touch it drags from anywhere, buttons included, except fields and
`[data-drawer-no-drag]`; a flick goes to the next stop in its direction.

**Stack CSS variables.** Each is read in one place, so set it where it is read
(or on an ancestor, where a value inherits down to it):

| Variable | Default | Read on |
| -------- | ------- | ------- |
| `--scroll-drawer-stack-scale` | `0.92` | The scroller of the drawer that recedes; set it on that drawer's root or on `:root` for all. |
| `--scroll-drawer-stack-shift` | `-8px` | Same as above. |
| `--scroll-drawer-backdrop-max` | `1`; `0.3` on a drawer stacked above another | The drawer's own backdrop. The package sets the `0.3` on the stacked drawer's root, so an ancestor value does not reach it: override with `overlayClassName="[--scroll-drawer-backdrop-max:0.2]"` or a rule on `[data-scroll-drawer-root][data-scroll-drawer-stacked]`. |
| `--scroll-drawer-backdrop-min` | `0`; `0.4` on a non-dismissible drawer | The drawer's own backdrop, same override rules as above. |
| `--scroll-drawer-fill` | The content's background | Set on `Drawer.Content` when its surface is painted by a child, so the part of the sheet below the resting layout and the area behind the translucent iOS keyboard aren't transparent. |

**`data-drawer-drag`** on (or around) a button or link lets a mouse drag start
there. A tap still clicks; the click a drag ends on is swallowed.

### Staying on v2

Swap the import. If you use the named parts, swap them too; the compound parts
(`Drawer.Content`, `Drawer.Scrollable`) follow the import on their own:

```tsx
import {
  LegacyDrawer as Drawer,
  LegacyDrawerContent as DrawerContent,
  LegacyDrawerScrollable as DrawerScrollable,
} from '@present-day/drawer/legacy'
```

(On v3 itself the import was `'@present-day/drawer'`.)

`LegacyDrawer` keeps the v2 behavior and the `--drawer-*` variables. The
scroll-engine-only props above are not available on it.

## v2.1 → v2.2

No API removals. Two default behaviors changed:

- **Safe-area bottom padding is on by default.** The panel now gets
  `padding-bottom: env(safe-area-inset-bottom, 0px)` and `'auto'` snap heights
  grow by the resolved inset. If your app already pads drawer content for the
  home indicator, pass `safeAreaBottom={false}` to keep your existing layout.
- **Escape inside a non-empty text field no longer dismisses.** The field
  clears first (native `type="search"` behavior); a second Escape on the empty
  field dismisses. `e.preventDefault()` on the keydown suppresses dismissal
  entirely.
- The keyboard lift (`bottom` offset) is now animated with the same spring as
  the height, and the panel gets an instant viewport `max-height` clamp — no
  action needed, but custom chrome that assumed an unanimated `bottom` should
  read `--drawer-layout-bottom-inset` for the target value.

# Migration: v1 → v2

`@present-day/drawer` v2 collapses the `sizing` prop and `DRAWER_SIZING`
preset object into a single `snapPoints` array and reuses `SNAP_POINT.FULL` for the `'full'`
token. The migration is mechanical and codemod-friendly: every change is a
1:1 rename or a small literal substitution.

## TL;DR find/replace

| Before                                          | After                              |
| ----------------------------------------------- | ---------------------------------- |
| `sizing="auto"` / `sizing={DRAWER_SIZING.AUTO}` | omit (default) or `snapPoints={['auto']}` |
| `sizing="full"` / `sizing={DRAWER_SIZING.FULL}` | `snapPoints={['full']}`            |
| `sizing={[…]}`                                  | `snapPoints={[…]}`                 |
| `import { DRAWER_SIZING } from '@present-day/drawer'` | _delete_ (no replacement) |
| `SnapPointValue` (type)                         | `SnapPoint`                        |
| `DrawerSizing` (type)                           | `SnapPoint[]` (or just remove the annotation) |
| `DrawerSizingPreset` (type)                     | _delete_ (no replacement)          |
| `SNAP_POINT.FULL` (value `0.9`)                 | `SNAP_POINT.NEAR_FULL` (same `0.9`) **or** `SNAP_POINT.MAX` (`1`) |

The new `SNAP_POINT.FULL` is the string token `'full'` (full available drawer
height). If you previously relied on `SNAP_POINT.FULL === 0.9`, you almost
certainly wanted `SNAP_POINT.MAX` — the old name was an artifact of an early
implementation that capped at 90%.

## Why these changes

**`sizing` and `snapPoints` were doing the same job.** The v1 `sizing` prop
accepted either a preset string (`'auto'` | `'full'`) or an array of snap
stops. But `['auto']` already expressed "content-sized" and `['full']`
already expressed "full-height" — the preset variant was sugar for what the
array form could already do, and we paid for it with two parallel constants
(`DRAWER_SIZING` and `SNAP_POINT`) that overlapped on `'auto'`. v2 keeps
only the array form.

**`SnapPoint` (renamed from `SnapPointValue`)** is the public type for any
single snap stop: `number | 'auto' | 'full'`. Use it in your own helpers and
state when the value can be any of those.

## Step-by-step

### 1. Rename the prop

```tsx
// before
<Drawer sizing="auto" />
<Drawer sizing="full" />
<Drawer sizing={[0.3, 0.6, 0.9]} />
<Drawer sizing={[SNAP_POINT.AUTO, 480, DRAWER_SIZING.FULL]} />

// after
<Drawer />
<Drawer snapPoints={['full']} />
<Drawer snapPoints={[0.3, 0.6, 0.9]} />
<Drawer snapPoints={[SNAP_POINT.AUTO, 480, SNAP_POINT.FULL]} />
```

`'auto'` is now the default `snapPoints` value, so most call sites can drop
the prop entirely.

### 2. Update imports and types

```ts
// before
import {
  DRAWER_SIZING,
  type DrawerSizing,
  type DrawerSizingPreset,
  type SnapPointValue,
} from '@present-day/drawer'

const stops: DrawerSizing = ['auto', 480, 'full']
const [active, setActive] = useState<SnapPointValue>(0.5)

// after
import { type SnapPoint } from '@present-day/drawer'

const stops: SnapPoint[] = ['auto', 480, 'full']
const [active, setActive] = useState<SnapPoint>(0.5)
```

### 3. Update `SNAP_POINT.FULL` users

`SNAP_POINT.FULL` used to equal `0.9`. In v2 it equals `'full'`.

```ts
// before
<Drawer sizing={[0.3, SNAP_POINT.FULL]} />   // resolved to 0.9 of available

// after — pick whichever you actually wanted:
<Drawer snapPoints={[0.3, SNAP_POINT.NEAR_FULL]} />  // same 0.9 behavior
<Drawer snapPoints={[0.3, SNAP_POINT.MAX]} />        // true full height
<Drawer snapPoints={[0.3, SNAP_POINT.FULL]} />       // also true full height (token)
```

`SNAP_POINT.MAX` (`1`) and `SNAP_POINT.FULL` (`'full'`) both resolve to the
full available drawer height. The token form composes more cleanly when
mixing with `'auto'`, since the resolver tags the resulting stop as `'full'`
in callbacks rather than `1`.

## Behavior notes

- **Default sizing.** `<Drawer />` with no `snapPoints` is now equivalent to
  the v1 `sizing={DRAWER_SIZING.AUTO}` — content-fit via `ResizeObserver`.
  No code change needed; this is a good time to remove redundant
  `sizing="auto"` props.
- **Single-stop arrays.** `snapPoints={['full']}` reports `'full'` (the
  string token) as the active raw value in `onSnapPointChange` and
  `getActiveSnapPoint()`. Under v1, `sizing={DRAWER_SIZING.FULL}` reported
  `1`. If you have code branching on the active raw value, accept both
  `'full'` and `1` during the upgrade.
- **`resolveSizingToHeights` (advanced API).** The internal helper exported
  from `useDrawerSnap` was renamed to `resolveSnapPointsToHeights` and now
  accepts only `SnapPoint[]`. Pass `['auto']` instead of the v1
  `DRAWER_SIZING.AUTO`, and `['full']` instead of `DRAWER_SIZING.FULL`.

## Vaul / shadcn drawer parity

After v2 the prop names line up with Vaul:

| Vaul                      | This package                      |
| ------------------------- | --------------------------------- |
| `snapPoints`              | `snapPoints` ✓                    |
| `activeSnapPoint`         | `activeSnapPoint` ✓               |
| `setActiveSnapPoint`      | `onSnapPointChange` (also passes `index`) |
| `dismissible`             | `dismissible` ✓                   |
| `modal`                   | `modal` ✓                         |
| `open` / `onOpenChange`   | `open` / `onOpenChange` ✓         |
| _(no equivalent)_         | `defaultSnapPoint`                |
| _(no equivalent)_         | `'auto'` token (content-fit)      |
| _(no equivalent)_         | `topInsetPx`                      |

If you’re migrating away from Vaul, the hot path is renaming
`<Drawer.Root>` to `<Drawer>` and removing Vaul’s compound parts in favor
of this package’s `Drawer.Content`, `Drawer.Handle`, etc. The snap-point
props and the controlled-state setter behave the same.
