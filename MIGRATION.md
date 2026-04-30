# Migration: v1 → v2

`@present-day/drawer` v2 collapses the `sizing` prop and `DRAWER_SIZING`
preset object into a single `snapPoints` array, renames the change callback
to match Vaul / shadcn drawer, and reuses `SNAP_POINT.FULL` for the `'full'`
token. The migration is mechanical and codemod-friendly: every change is a
1:1 rename or a small literal substitution.

## TL;DR find/replace

| Before                                          | After                              |
| ----------------------------------------------- | ---------------------------------- |
| `sizing="auto"` / `sizing={DRAWER_SIZING.AUTO}` | omit (default) or `snapPoints={['auto']}` |
| `sizing="full"` / `sizing={DRAWER_SIZING.FULL}` | `snapPoints={['full']}`            |
| `sizing={[…]}`                                  | `snapPoints={[…]}`                 |
| `onSnapPointChange={fn}`                        | `setActiveSnapPoint={fn}`          |
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

**`onSnapPointChange` is now `setActiveSnapPoint`** to match the Vaul /
shadcn drawer convention. The signature is a strict superset of theirs —
we still pass the resolved `index` as a second argument, so existing
handlers continue to work after the rename.

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

### 2. Rename the callback

```tsx
// before
<Drawer onSnapPointChange={(point, index) => …} />

// after
<Drawer setActiveSnapPoint={(point, index) => …} />
```

The signature is unchanged.

### 3. Update imports and types

```ts
// before
import {
  DRAWER_SIZING,
  type DrawerSizing,
  type DrawerSizingPreset,
  type SnapPointValue,
} from '@present-day/drawer'

const stops: DrawerSizing = ['auto', 480, 'full']
const active = useState<SnapPointValue>(0.5)

// after
import { type SnapPoint } from '@present-day/drawer'

const stops: SnapPoint[] = ['auto', 480, 'full']
const active = useState<SnapPoint>(0.5)
```

### 4. Update `SNAP_POINT.FULL` users

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
  string token) as the active raw value in `setActiveSnapPoint` and
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
| `setActiveSnapPoint`      | `setActiveSnapPoint` (richer signature: also passes `index`) |
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
