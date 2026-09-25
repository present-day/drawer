import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  DRAWER_TOP_INSET_PX,
  Drawer,
  type DrawerProps,
  type DrawerRef,
  SNAP_POINT,
  type SnapPoint,
} from '../src'
import {
  BaseContent,
  BodyText,
  DemoPage,
  demoSlots,
  LongScrollableContent,
  SearchWithListContent,
  Skeleton,
  useDemoOpen,
  useEventLog,
  useLoggedCallbacks,
} from './demo'

type DemoContent = 'short' | 'long' | 'search-auto' | 'search-snaps'

type StoryArgs = Pick<
  DrawerProps,
  | 'snapPoints'
  | 'defaultSnapPoint'
  | 'modal'
  | 'dismissible'
  | 'focusTrap'
  | 'handleOnly'
  | 'snapToSequentialPoint'
  | 'fadeFromIndex'
  | 'topInsetPx'
  | 'bottomInsetPx'
  | 'safeAreaBottom'
  | 'overlayClassName'
> & {
  title?: string
  description?: string
  /** What goes inside `Drawer.Content`. */
  content: DemoContent
  /** Heading and body for the `short` content. */
  heading: string
  body: string
  /** Adds a close button inside the sheet (for `dismissible={false}`). */
  closeButton: boolean
  contentClassName: string
  handleIndicatorClassName: string
  /** Renders a fixed bottom nav bar `bottomInsetPx` tall. */
  bottomChrome: boolean
  pageTitle: string
  pageDescription: string
}

const hidden = { table: { disable: true } } as const

const meta = {
  title: 'Drawer',
  args: {
    snapPoints: [SNAP_POINT.AUTO],
    modal: true,
    dismissible: true,
    focusTrap: true,
    handleOnly: false,
    snapToSequentialPoint: false,
    topInsetPx: DRAWER_TOP_INSET_PX,
    bottomInsetPx: 0,
    safeAreaBottom: true,
    overlayClassName: '',
    title: '',
    description: '',
    content: 'short',
    heading: 'Content-sized (AUTO)',
    body: 'Edit the props in the Controls panel; the drawer reopens with them.',
    closeButton: false,
    contentClassName: '',
    handleIndicatorClassName: '',
    bottomChrome: false,
    pageTitle: 'Drawer playground',
    pageDescription:
      'Open the drawer, then drag the sheet, handle, and scroll areas. Events appear in the log below.',
  },
  argTypes: {
    snapPoints: {
      control: 'object',
      description:
        "Fractions (≤ 1), pixels (> 1), or 'auto' / 'full' / 'screen'",
    },
    defaultSnapPoint: { control: false },
    content: {
      control: 'inline-radio',
      options: ['short', 'long', 'search-auto', 'search-snaps'],
    },
    topInsetPx: { control: { type: 'range', min: 0, max: 240, step: 8 } },
    bottomInsetPx: { control: { type: 'range', min: 0, max: 160, step: 4 } },
    fadeFromIndex: { control: { type: 'number', min: 0, step: 1 } },
    safeAreaBottom: { control: 'boolean' },
    contentClassName: {
      control: 'text',
      description: 'Merged into slots.contentClassName after the demo surface',
    },
    handleIndicatorClassName: { control: 'text' },
    pageTitle: hidden,
    pageDescription: hidden,
  },
  render: (args) => <ScenarioDemo {...args} />,
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

function ScenarioDemo({
  content,
  heading,
  body,
  closeButton,
  contentClassName,
  handleIndicatorClassName,
  bottomChrome,
  pageTitle,
  pageDescription,
  title,
  description,
  page,
  ...drawerProps
}: StoryArgs & { page?: ReactNode }) {
  const { lines, push } = useEventLog()
  const { open, setOpen, onOpenChange } = useDemoOpen(push)
  const callbacks = useLoggedCallbacks(push)
  const bottomInset = drawerProps.bottomInsetPx ?? 0
  // Remount on any prop change so open-time props (defaultSnapPoint, the
  // intro animation) apply the same way they would on a fresh open.
  const key = JSON.stringify({ content, heading, body, title, ...drawerProps })

  return (
    <DemoPage
      title={pageTitle}
      description={pageDescription}
      onOpen={() => setOpen(true)}
      log={lines}
      logBottomPx={bottomChrome ? bottomInset : 0}
    >
      {page}
      <Drawer
        key={key}
        open={open}
        onOpenChange={onOpenChange}
        slots={{
          contentClassName: `${demoSlots.contentClassName} ${contentClassName}`,
          handleIndicatorClassName: handleIndicatorClassName || undefined,
        }}
        ariaLabel="Demo drawer"
        title={title || undefined}
        description={description || undefined}
        {...drawerProps}
        overlayClassName={drawerProps.overlayClassName || undefined}
        {...callbacks}
      >
        {content === 'long' ? (
          <LongScrollableContent />
        ) : content === 'search-auto' ? (
          <SearchWithListContent kind="auto" />
        ) : content === 'search-snaps' ? (
          <SearchWithListContent kind="snaps" />
        ) : (
          <BaseContent heading={heading}>
            <BodyText>{body}</BodyText>
            {closeButton ? (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm text-accent-fg"
              >
                Close drawer
              </button>
            ) : null}
          </BaseContent>
        )}
      </Drawer>
      {bottomChrome ? (
        <nav
          aria-label="Demo bottom navigation"
          style={{ height: bottomInset }}
          className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-around border-t border-line bg-surface text-xs font-medium text-muted"
        >
          <span>Home</span>
          <span>Search</span>
          <span>Profile</span>
        </nav>
      ) : null}
    </DemoPage>
  )
}

/** Every main prop is a control; the drawer reopens when they change. */
export const Playground: Story = {}

export const AutoShortContent: Story = {
  name: 'AUTO — short content',
  args: {
    pageTitle: 'AUTO — short content',
    pageDescription: 'Intrinsic height; should match a small block of text.',
    heading: 'Content-sized (AUTO)',
    body: 'A short body — height follows intrinsic content. Resize the window to see the cap change.',
  },
}

export const AutoLongScrollableList: Story = {
  name: 'AUTO — long scrollable list',
  args: {
    pageTitle: 'AUTO — long scrollable list',
    pageDescription:
      'Drawer.Scrollable with many rows; content measurement and inner scroll.',
    content: 'long',
  },
}

export const AutoSearchKeyboard: Story = {
  name: 'AUTO — search + list (iOS keyboard)',
  args: {
    pageTitle: 'AUTO — search + list (iOS keyboard)',
    pageDescription:
      'Search field at the top: test soft keyboard with AUTO height and visual viewport.',
    content: 'search-auto',
    title: 'Search',
    description: 'AUTO height with a search field — keyboard test on iOS',
  },
}

export const SnapsSearchKeyboard: Story = {
  name: 'Snaps + search (compare)',
  args: {
    pageTitle: 'Snaps + search (compare)',
    pageDescription:
      'Same search UI with [0.45, 0.75, 0.96] stops — compare to the AUTO search case on mobile.',
    content: 'search-snaps',
    snapPoints: [0.45, 0.75, 0.96],
    defaultSnapPoint: 0.75,
    title: 'Search',
    description: 'Fractional snaps with a search field',
  },
}

function AutoLoadingDemo() {
  const { lines, push } = useEventLog()
  const { open, setOpen, onOpenChange } = useDemoOpen(push)
  const { onSnapPointChange, onAnimationComplete } = useLoggedCallbacks(push)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = window.setTimeout(() => {
      setLoading(false)
      push('simulated fetch done — content replaced with a taller block')
    }, 1500)
    return () => {
      clearTimeout(t)
    }
  }, [open, push])

  return (
    <DemoPage
      title="AUTO — loading then taller"
      description="Two-line skeleton for ~1.5s, then more copy; sheet height should follow."
      onOpen={() => setOpen(true)}
      log={lines}
    >
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        slots={demoSlots}
        snapPoints={[SNAP_POINT.AUTO]}
        title="AUTO and async content"
        onSnapPointChange={onSnapPointChange}
        onAnimationComplete={onAnimationComplete}
      >
        <BaseContent heading="Short skeleton, then more content">
          {loading ? (
            <Skeleton widths={['w-2/3 max-w-sm', 'w-1/2 max-w-xs']} />
          ) : (
            <div className="space-y-3">
              {(['s1', 's2', 's3', 's4', 's5', 's6'] as const).map((id, i) => (
                <p key={id} className="text-sm leading-relaxed opacity-75">
                  Loaded section {i + 1} — the sheet should grow from the
                  compact loading state to this taller layout (ResizeObserver +
                  AUTO).
                </p>
              ))}
            </div>
          )}
        </BaseContent>
      </Drawer>
    </DemoPage>
  )
}

export const AutoLoadingThenTaller: Story = {
  name: 'AUTO — loading then taller',
  render: () => <AutoLoadingDemo />,
}

/**
 * Mixed snap points: `'auto'` as one snap, plus explicit pixel/full stops
 * above it. Demonstrates the loading→taller transition where the auto stop
 * tracks the measured content while the higher stops remain fixed and exceed
 * the content.
 *
 * Verifies:
 *   1. `'auto'` slot follows the live `ResizeObserver` measurement (skeleton
 *      → 4 paragraphs grows the lowest stop, with the panel docked there).
 *   2. Dragging up to the `'full'` stop sits the panel well above content
 *      height without the slow 1px-per-frame upward drift.
 *   3. Swapping content while sitting at a non-auto snap does not jolt the
 *      drawer off that stop.
 */
function MixedSnapsLoadingDemo() {
  const { lines, push } = useEventLog()
  const { open, setOpen, onOpenChange } = useDemoOpen(push)
  const { onSnapPointChange, onAnimationComplete } = useLoggedCallbacks(push)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = window.setTimeout(() => {
      setLoading(false)
      push('simulated fetch done — content swapped to taller block')
    }, 1500)
    return () => {
      clearTimeout(t)
    }
  }, [open, push])

  return (
    <DemoPage
      title="Mixed: AUTO + pixel + FULL snaps"
      description="snapPoints=[AUTO, 480, FULL] with a skeleton→taller content swap. AUTO slot tracks measured content; 480/FULL stay above it."
      onOpen={() => setOpen(true)}
      log={lines}
    >
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        slots={demoSlots}
        // First stop is content-fit ('auto'), second is a fixed pixel value,
        // and the top stop fills the available drawer area ('full'). Default
        // opens at 480px — taller than the loading skeleton, so you can verify
        // the 'auto' slot moves in/out beneath the active snap as content
        // settles.
        snapPoints={[SNAP_POINT.AUTO, 480, SNAP_POINT.FULL]}
        defaultSnapPoint={480}
        title="Mixed snap points: AUTO + pixel + FULL"
        onSnapPointChange={onSnapPointChange}
        onAnimationComplete={onAnimationComplete}
      >
        <BaseContent heading="snapPoints=[AUTO, 480, FULL] · skeleton, then taller">
          <p className="mb-3 text-xs opacity-75">
            Default opens at 480px. Drag down to land on the AUTO slot
            (content-fit) — its height grows when the fetch completes. Drag up
            to FULL — panel should land cleanly with no slow upward drift.
          </p>
          {loading ? (
            <Skeleton
              widths={['w-2/3 max-w-sm', 'w-1/2 max-w-xs', 'w-3/5 max-w-sm']}
            />
          ) : (
            <div className="space-y-3">
              {(['s1', 's2', 's3', 's4'] as const).map((id, i) => (
                <p key={id} className="text-sm leading-relaxed opacity-75">
                  Loaded section {i + 1} — content is now taller. The AUTO slot
                  tracks this height; the 480 and FULL stops do not.
                </p>
              ))}
            </div>
          )}
        </BaseContent>
      </Drawer>
    </DemoPage>
  )
}

export const MixedAutoPixelFull: Story = {
  name: 'Mixed: AUTO + pixel + FULL snaps',
  render: () => <MixedSnapsLoadingDemo />,
}

export const Full: Story = {
  name: 'FULL',
  args: {
    pageTitle: 'FULL',
    pageDescription:
      'Single snap at available height — viewport MINUS topInsetPx (96px). Note the gap at the top.',
    content: 'long',
    snapPoints: [SNAP_POINT.FULL],
  },
}

export const Screen: Story = {
  name: 'SCREEN',
  args: {
    pageTitle: 'SCREEN',
    pageDescription:
      'Single snap at the ENTIRE viewport — top edge touches the top. Compare against FULL.',
    content: 'long',
    snapPoints: [SNAP_POINT.SCREEN],
  },
}

export const ScreenWithKeyboard: Story = {
  name: 'SCREEN + keyboard',
  args: {
    pageTitle: 'SCREEN + keyboard',
    pageDescription:
      'AUTO at rest, SCREEN on focus. Tap the field on a phone: the sheet takes the whole screen.',
    content: 'search-auto',
    // Rests at content height, expands edge-to-edge on focus. This is the
    // pairing FULL cannot express: FULL is capped at viewport - topInsetPx,
    // and topInsetPx is per-drawer, so it cannot be inset at rest AND reach
    // the top on demand.
    snapPoints: [SNAP_POINT.AUTO, SNAP_POINT.SCREEN],
    defaultSnapPoint: SNAP_POINT.AUTO,
  },
}

export const FractionSnaps: Story = {
  name: 'Fraction snaps',
  args: {
    pageTitle: 'Fraction snaps',
    pageDescription: 'SNAP_POINT.PEEK, HALF, MAX — mix of px peek and ratios.',
    snapPoints: [SNAP_POINT.PEEK, SNAP_POINT.HALF, SNAP_POINT.MAX],
    heading: 'Fractions + px-style constants',
    body: 'Snaps: PEEK (80px), HALF, MAX. Flick up/down to change stops.',
  },
}

export const PixelSnaps: Story = {
  name: 'Pixel snaps',
  args: {
    pageTitle: 'Pixel snaps',
    pageDescription: '[140, 300, 480] — values > 1 are pixel heights.',
    snapPoints: [140, 300, 480],
    heading: 'Fixed pixel stops',
    body: 'Values > 1 are read as pixel heights. Try slow drags to land between stops.',
  },
}

export const DefaultSnapPoint: Story = {
  name: 'defaultSnapPoint',
  args: {
    pageTitle: 'defaultSnapPoint',
    pageDescription: 'Opens to the middle stop (0.45) of [0.2, 0.45, 0.7].',
    snapPoints: [0.2, 0.45, 0.7],
    defaultSnapPoint: 0.45,
    heading: 'Opens at middle (defaultSnapPoint=0.45)',
    body: 'Close and re-open: intro animation should target the default stop.',
  },
}

export const NotDismissible: Story = {
  name: 'Not dismissible',
  args: {
    pageTitle: 'Not dismissible',
    pageDescription:
      'dismissible=false; cannot fling/drag to close. Use Close in the sheet.',
    snapPoints: [0.35, 0.65],
    dismissible: false,
    heading: 'Cannot drag-dismiss',
    body: 'Dragging below the lowest snap should not close the panel. Use the button below.',
    closeButton: true,
  },
}

function NonModalPage() {
  const [clicks, setClicks] = useState(0)
  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        onClick={() => setClicks((n) => n + 1)}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
      >
        Page button — clicked {clicks} {clicks === 1 ? 'time' : 'times'}
      </button>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
        <p key={n} className="text-sm text-muted">
          Page paragraph {n}. Scroll the page while the drawer is open to
          confirm the body is not locked.
        </p>
      ))}
    </div>
  )
}

export const NonModal: Story = {
  name: 'Non-modal',
  args: {
    pageTitle: 'Non-modal',
    pageDescription:
      'modal=false; no dimmer — interact with this page while open.',
    modal: false,
    heading: 'Non-modal (no dimmer, no body lock by default pattern)',
    body: 'The page behind stays interactive. Click the page button or scroll the page to verify. Drag the handle area to resize.',
  },
  render: (args) => <ScenarioDemo {...args} page={<NonModalPage />} />,
}

export const TopInsetZero: Story = {
  name: 'topInsetPx = 0',
  args: {
    pageTitle: 'topInsetPx = 0',
    pageDescription:
      'No top offset for snap math — taller usable stops vs default 96px.',
    topInsetPx: 0,
    snapPoints: [0.35, 0.65, 0.92],
    heading: 'topInsetPx = 0',
    body: 'Full viewport height is available for snap math (no map chrome offset). Compare to other cases (default 96px inset).',
  },
}

export const BottomInset: Story = {
  name: 'bottomInsetPx (bottom chrome)',
  args: {
    pageTitle: 'bottomInsetPx',
    pageDescription:
      'The sheet sits above a 64px fixed nav bar instead of covering it, and snap heights shrink by the same amount. With the keyboard up, the larger of the two insets wins.',
    snapPoints: [SNAP_POINT.AUTO, SNAP_POINT.FULL],
    bottomInsetPx: 64,
    bottomChrome: true,
    heading: 'bottomInsetPx = 64',
    body: 'Drag to FULL: the top stays topInsetPx from the top and the bottom stays on top of the nav bar.',
  },
}

export const AccessibleTitle: Story = {
  name: 'title + description a11y',
  args: {
    pageTitle: 'title + description a11y',
    pageDescription:
      'Screen-reader label props on the root dialog (inspect in the a11y tree, or the Accessibility addon panel).',
    title: 'Accessible title for screen readers',
    description: 'Optional description string linked to the dialog.',
    snapPoints: [0.4, 0.7],
    heading: 'Visually plain content',
    body: 'Title/description are in the DOM (screen-reader only by default; check with VoiceOver or DevTools a11y tree).',
  },
}

export const Theming: Story = {
  name: 'Theming: slots + overlay',
  args: {
    pageTitle: 'Theming: slots + overlay',
    pageDescription:
      'overlayClassName blurs a lighter dimmer; slots restyle the surface and handle bar.',
    overlayClassName: 'bg-black/30 backdrop-blur-sm',
    contentClassName: 'bg-zinc-900 text-white',
    handleIndicatorClassName: 'bg-white/30',
    heading: 'Custom surface',
    body: 'Merge order: package defaults → slots → each part’s own className.',
  },
}

export const OverlayFadeFromIndex: Story = {
  name: 'fadeFromIndex (overlay by snap)',
  args: {
    pageTitle: 'fadeFromIndex',
    pageDescription:
      'No dimmer at the lowest stop; the overlay fades in as the sheet rises and is fully opaque from index 2.',
    snapPoints: [0.25, 0.5, 0.9],
    defaultSnapPoint: 0.25,
    fadeFromIndex: 2,
    heading: 'fadeFromIndex = 2',
    body: 'Drag between stops and watch the overlay opacity follow the sheet.',
  },
}

function ImperativeDemo() {
  const { lines, push } = useEventLog()
  const { open, setOpen, onOpenChange } = useDemoOpen(push)
  const callbacks = useLoggedCallbacks(push)
  const ref = useRef<DrawerRef>(null)

  return (
    <DemoPage
      title="Imperative ref"
      description="snapTo, expand, collapse, dismiss, getHeight, getActiveSnapPoint."
      onOpen={() => setOpen(true)}
      log={lines}
    >
      <Drawer
        ref={ref}
        open={open}
        onOpenChange={onOpenChange}
        slots={demoSlots}
        snapPoints={[0.35, 0.6, 0.9]}
        title="Imperative API"
        {...callbacks}
      >
        <BaseContent heading="Imperative">
          <BodyText>
            Use the floating controls (above the dimmer) to call ref methods.
            Drag still works.
          </BodyText>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-3 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
          >
            Close from content
          </button>
        </BaseContent>
      </Drawer>
      {open ? (
        <div className="pointer-events-auto fixed left-1/2 top-2 z-[200] flex max-w-full -translate-x-1/2 flex-wrap justify-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-lg">
          {(
            [
              ['snap 0.35', () => ref.current?.snapTo(0.35)],
              ['snap 0.6', () => ref.current?.snapTo(0.6)],
              ['expand', () => ref.current?.expand()],
              ['collapse', () => ref.current?.collapse()],
              ['dismiss', () => ref.current?.dismiss()],
              ['log height', () => push(`height=${ref.current?.getHeight()}`)],
              [
                'active',
                () =>
                  push(`active=${String(ref.current?.getActiveSnapPoint())}`),
              ],
            ] as const
          ).map(([label, fn]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                fn()
                push(`>${label}`)
              }}
              className="rounded-md bg-subtle px-2 py-1 text-xs font-medium text-fg"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </DemoPage>
  )
}

export const ImperativeRef: Story = {
  name: 'Imperative ref',
  render: () => <ImperativeDemo />,
}

const CONTROLLED_SNAPS = [0.25, 0.5, 0.75] as const

function ControlledSnapDemo() {
  const { lines, push } = useEventLog()
  const { open, setOpen, onOpenChange } = useDemoOpen(push)
  const [active, setActive] = useState<SnapPoint>(0.5)

  return (
    <DemoPage
      title="Controlled active snap"
      description="Parent-owned activeSnapPoint with buttons to jump between stops."
      onOpen={() => setOpen(true)}
      log={lines}
    >
      {open ? (
        <div className="pointer-events-auto fixed right-2 top-2 z-[200] flex max-w-[min(100%,20rem)] flex-col gap-1.5 rounded-2xl border border-line bg-surface p-2 shadow-lg">
          <span className="px-1 text-xs font-medium text-muted">
            Controlled <code className="text-fg">activeSnapPoint</code>
          </span>
          <div className="flex flex-wrap gap-1">
            {CONTROLLED_SNAPS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setActive(p)
                  push(`set activeSnapPoint -> ${p}`)
                }}
                className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-950"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        slots={demoSlots}
        snapPoints={[...CONTROLLED_SNAPS]}
        defaultSnapPoint={0.5}
        activeSnapPoint={active}
        onSnapPointChange={(p, i) => {
          setActive(p)
          push(`onSnapPointChange: raw=${p} i=${i}`)
        }}
      >
        <BaseContent heading="Active snap is driven by the buttons in the top-right">
          <BodyText>
            Parent state: <code>{String(active)}</code>
          </BodyText>
        </BaseContent>
      </Drawer>
    </DemoPage>
  )
}

export const ControlledActiveSnap: Story = {
  name: 'Controlled active snap',
  render: () => <ControlledSnapDemo />,
}
