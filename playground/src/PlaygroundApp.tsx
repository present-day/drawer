import {
  DRAWER_SIZING,
  type DragEndInfo,
  Drawer,
  type DrawerProps,
  type DrawerRef,
  SNAP_POINT,
  type SnapPointValue,
} from '@present-day/drawer'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

type ScenarioId =
  | 'autoShort'
  | 'autoLong'
  | 'autoSearch'
  | 'full'
  | 'snapsFractions'
  | 'snapsPixels'
  | 'snapsSearch'
  | 'defaultSnap'
  | 'notDismissible'
  | 'nonModal'
  | 'topInset0'
  | 'a11yTitle'
  | 'imperative'
  | 'controlledSnap'
  | 'autoLoading'
  | 'snapsLoadingTallerThanContent'

type LogLine = { t: number; text: string }

const LONG_ITEMS = Array.from({ length: 45 }, (_, i) => i + 1)

function Panel({
  title,
  description,
  onOpen,
}: {
  title: string
  description: string
  onOpen: () => void
}) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <p className="min-h-12 text-sm text-zinc-600">{description}</p>
      <button
        type="button"
        onClick={onOpen}
        className="self-start rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Open
      </button>
    </li>
  )
}

function baseContent(title: string, body: ReactNode) {
  return (
    <Drawer.Content>
      <Drawer.Handle />
      <div className="px-4 pb-5 pt-0">
        <h3 className="mb-2 text-sm font-medium text-zinc-800">{title}</h3>
        {body}
      </div>
    </Drawer.Content>
  )
}

/**
 * Search field + list: use on iOS Safari to see AUTO height and visual-viewport
 * anchoring when the soft keyboard is up.
 */
function searchWithListContent(kind: 'auto' | 'snaps') {
  const id = `playground-search-${kind}`
  return (
    <Drawer.Content>
      <Drawer.Handle />
      <div className="px-4 pt-0">
        <h3 className="mb-2 text-sm font-medium text-zinc-800">
          {kind === 'auto' ? 'Search (AUTO height)' : 'Search (snap heights)'}
        </h3>
        <p className="mb-3 text-sm text-zinc-600">
          {kind === 'auto' ? (
            <>
              Focus the field to show the on-screen keyboard. With{' '}
              <code className="text-zinc-800">sizing=auto</code>, height follows
              content and the sheet should stay aligned above the keyboard.
            </>
          ) : (
            <>
              Same search UI as the AUTO case, with fractional snap stops.
              Compare how the panel responds when the keyboard opens (e.g. drag
              to MAX first, then focus the field).
            </>
          )}
        </p>
        <label className="block" htmlFor={id}>
          <span className="text-xs font-medium text-zinc-500">Query</span>
          <input
            id={id}
            name={id}
            type="search"
            enterKeyHint="search"
            placeholder="Type to test the keyboard…"
            autoComplete="off"
            autoCapitalize="off"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
          />
        </label>
      </div>
      <Drawer.Scrollable className="px-4 pb-5">
        <p className="mb-2 text-xs text-zinc-500">
          Scroll the list in the sheet; drag the handle area (not the field) to
          resize the drawer.
        </p>
        <ul className="space-y-2">
          {Array.from({ length: 20 }, (_, idx) => idx + 1).map((n) => (
            <li
              key={n}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
            >
              Sample result {n}
            </li>
          ))}
        </ul>
      </Drawer.Scrollable>
    </Drawer.Content>
  )
}

function longScrollableContent() {
  return (
    <Drawer.Content>
      <Drawer.Handle />
      <Drawer.Scrollable className="px-4 pb-5">
        <p className="mb-2 text-sm text-zinc-500">
          Scroll inside the panel. Drag the sheet (outside this list) to resize
          / dismiss.
        </p>
        <ul className="space-y-2">
          {LONG_ITEMS.map((n) => (
            <li
              key={n}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
            >
              List row {n}
            </li>
          ))}
        </ul>
      </Drawer.Scrollable>
    </Drawer.Content>
  )
}

function ImperativeDemo({
  open,
  onOpenChange,
  onLog,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLog: (line: string) => void
}) {
  const ref = useRef<DrawerRef>(null)
  return (
    <>
      <Drawer
        ref={ref}
        key="imperative"
        open={open}
        onOpenChange={onOpenChange}
        sizing={[0.35, 0.6, 0.9]}
        title="Imperative API"
        onSnapPointChange={(p, i) => onLog(`snap: raw=${p} index=${i}`)}
        onAnimationComplete={(p) => onLog(`anim done: ${p}`)}
        onDragEnd={(_e, info) =>
          onLog(
            `onDragEnd: target=${String(info.targetSnapPoint)} v=${info.velocity.toFixed(0)}`,
          )
        }
      >
        {baseContent('Imperative', [
          <p key="1" className="text-sm text-zinc-600">
            Use the floating controls (above the dimmer) to call ref methods.
            Drag still works.
          </p>,
          <button
            key="2"
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-3 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            Close from content
          </button>,
        ])}
      </Drawer>
      {open ? (
        <div className="pointer-events-auto fixed left-1/2 top-2 z-[200] flex max-w-full -translate-x-1/2 flex-wrap justify-center gap-1.5 rounded-2xl border border-zinc-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
          {(
            [
              ['snap 0.35', () => ref.current?.snapTo(0.35)],
              ['snap 0.6', () => ref.current?.snapTo(0.6)],
              ['expand', () => ref.current?.expand()],
              ['collapse', () => ref.current?.collapse()],
              ['dismiss', () => ref.current?.dismiss()],
              ['log height', () => onLog(`height=${ref.current?.getHeight()}`)],
              [
                'active',
                () =>
                  onLog(`active=${String(ref.current?.getActiveSnapPoint())}`),
              ],
            ] as const
          ).map(([label, fn]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                fn()
                onLog(`>${label}`)
              }}
              className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-800"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}

function ControlledSnapDemo({
  open,
  onOpenChange,
  onLog,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLog: (line: string) => void
}) {
  const [active, setActive] = useState<SnapPointValue>(0.3)
  return (
    <>
      {open ? (
        <div className="pointer-events-auto fixed right-2 top-2 z-[200] flex max-w-[min(100%,20rem)] flex-col gap-1.5 rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-lg">
          <span className="px-1 text-xs font-medium text-zinc-500">
            Controlled <code className="text-zinc-700">activeSnapPoint</code>
          </span>
          <div className="flex flex-wrap gap-1">
            {([0.25, 0.5, 0.75] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setActive(p)
                  onLog(`set activeSnapPoint -> ${p}`)
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
        key="controlled"
        open={open}
        onOpenChange={onOpenChange}
        sizing={[0.25, 0.5, 0.75]}
        defaultSnapPoint={0.3}
        activeSnapPoint={active}
        onSnapPointChange={(p, i) => {
          setActive(p)
          onLog(`onSnapPointChange: raw=${p} i=${i}`)
        }}
      >
        {baseContent('Active snap is driven by the buttons in the top-right', [
          <p key="1" className="text-sm text-zinc-600">
            Parent state: <code>{String(active)}</code>
          </p>,
        ])}
      </Drawer>
    </>
  )
}

function AutoLoadingDemo({
  open,
  onOpenChange,
  onLog,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLog: (line: string) => void
}) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = window.setTimeout(() => {
      setLoading(false)
      onLog('simulated fetch done — content replaced with a taller block')
    }, 1500)
    return () => {
      clearTimeout(t)
    }
  }, [open, onLog])

  return (
    <Drawer
      key="auto-loading"
      open={open}
      onOpenChange={onOpenChange}
      sizing={DRAWER_SIZING.AUTO}
      title="AUTO and async content"
      onSnapPointChange={(p, i) => onLog(`onSnapPointChange: ${p} i=${i}`)}
      onAnimationComplete={(p) =>
        onLog(`onAnimationComplete: snap ${String(p)}`)
      }
    >
      <Drawer.Content>
        <Drawer.Handle />
        <div className="px-4 pb-5 pt-0">
          <h3 className="mb-2 text-sm font-medium text-zinc-800">
            Short skeleton, then more content
          </h3>
          {loading ? (
            <div
              className="space-y-2"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="h-3 w-2/3 max-w-sm animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-1/2 max-w-xs animate-pulse rounded bg-zinc-200" />
            </div>
          ) : (
            <div className="space-y-3">
              {(['s1', 's2', 's3', 's4', 's5', 's6'] as const).map((id, i) => (
                <p key={id} className="text-sm leading-relaxed text-zinc-600">
                  Loaded section {i + 1} — the sheet should grow from the
                  compact loading state to this taller layout (ResizeObserver +
                  AUTO).
                </p>
              ))}
            </div>
          )}
        </div>
      </Drawer.Content>
    </Drawer>
  )
}

/**
 * Mixed sizing: `'auto'` as one snap, plus explicit pixel/full stops above it.
 * Demonstrates the loading→taller transition where the auto stop tracks the
 * measured content while the higher stops remain fixed and exceed the content.
 *
 * Verifies:
 *   1. `'auto'` slot follows the live `ResizeObserver` measurement (skeleton
 *      → 4 paragraphs grows the lowest stop, with the panel docked there).
 *   2. Dragging up to the `'full'` stop sits the panel well above content
 *      height without the slow 1px-per-frame upward drift.
 *   3. Swapping content while sitting at a non-auto snap does not jolt the
 *      drawer off that stop.
 */
function SnapsLoadingTallerThanContentDemo({
  open,
  onOpenChange,
  onLog,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLog: (line: string) => void
}) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = window.setTimeout(() => {
      setLoading(false)
      onLog('simulated fetch done — content swapped to taller block')
    }, 1500)
    return () => {
      clearTimeout(t)
    }
  }, [open, onLog])

  return (
    <Drawer
      key="snaps-loading-taller-than-content"
      open={open}
      onOpenChange={onOpenChange}
      // First stop is content-fit ('auto'), second is a fixed pixel value, and
      // the top stop fills the available drawer area ('full'). Default opens
      // at 480px — taller than the loading skeleton, so you can verify the
      // 'auto' slot moves in/out beneath the active snap as content settles.
      sizing={[SNAP_POINT.AUTO, 480, DRAWER_SIZING.FULL]}
      defaultSnapPoint={480}
      title="Mixed sizing: AUTO + pixel + FULL"
      onSnapPointChange={(p, i) => onLog(`onSnapPointChange: ${p} i=${i}`)}
      onAnimationComplete={(p) =>
        onLog(`onAnimationComplete: snap ${String(p)}`)
      }
    >
      <Drawer.Content>
        <Drawer.Handle />
        <div className="px-4 pb-5 pt-0">
          <h3 className="mb-2 text-sm font-medium text-zinc-800">
            sizing=[AUTO, 480, FULL] · skeleton, then taller
          </h3>
          <p className="mb-3 text-xs text-zinc-500">
            Default opens at 480px. Drag down to land on the AUTO slot
            (content-fit) — its height grows when the fetch completes. Drag up
            to FULL — panel should land cleanly with no slow upward drift.
          </p>
          {loading ? (
            <div
              className="space-y-2"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="h-3 w-2/3 max-w-sm animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-1/2 max-w-xs animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-3/5 max-w-sm animate-pulse rounded bg-zinc-200" />
            </div>
          ) : (
            <div className="space-y-3">
              {(['s1', 's2', 's3', 's4'] as const).map((id, i) => (
                <p key={id} className="text-sm leading-relaxed text-zinc-600">
                  Loaded section {i + 1} — content is now taller. The AUTO slot
                  tracks this height; the 480 and FULL stops do not.
                </p>
              ))}
            </div>
          )}
        </div>
      </Drawer.Content>
    </Drawer>
  )
}

type StandardScenario = Exclude<
  ScenarioId,
  | 'imperative'
  | 'controlledSnap'
  | 'autoLoading'
  | 'snapsLoadingTallerThanContent'
>

function getScenarioDrawer(
  id: StandardScenario,
  onRequestClose: () => void,
): {
  drawer: Omit<DrawerProps, 'open' | 'onOpenChange' | 'children'>
  children: ReactNode
} {
  const cases: Record<
    StandardScenario,
    {
      drawer: Omit<DrawerProps, 'open' | 'onOpenChange' | 'children'>
      children: ReactNode
    }
  > = {
    autoShort: {
      drawer: { sizing: DRAWER_SIZING.AUTO },
      children: baseContent('Content-sized (AUTO)', [
        <p key="1" className="text-sm text-zinc-600">
          A short body — height follows intrinsic content. Resize the window to
          see the cap change.
        </p>,
      ]),
    },
    autoLong: {
      drawer: { sizing: DRAWER_SIZING.AUTO },
      children: longScrollableContent(),
    },
    autoSearch: {
      drawer: {
        sizing: DRAWER_SIZING.AUTO,
        title: 'Search',
        description: 'AUTO height with a search field — keyboard test on iOS',
      },
      children: searchWithListContent('auto'),
    },
    full: {
      drawer: { sizing: DRAWER_SIZING.FULL },
      children: longScrollableContent(),
    },
    snapsFractions: {
      drawer: { sizing: [SNAP_POINT.PEEK, SNAP_POINT.HALF, SNAP_POINT.MAX] },
      children: baseContent('Fractions + px-style constants', [
        <p key="1" className="text-sm text-zinc-600">
          Snaps: PEEK (80px), HALF, MAX. Flick up/down to change stops.
        </p>,
      ]),
    },
    snapsPixels: {
      drawer: { sizing: [140, 300, 480] },
      children: baseContent('Fixed pixel stops', [
        <p key="1" className="text-sm text-zinc-600">
          Values &gt; 1 are read as pixel heights. Try slow drags to land
          between stops.
        </p>,
      ]),
    },
    snapsSearch: {
      drawer: {
        sizing: [0.45, 0.75, 0.96],
        defaultSnapPoint: 0.75,
        title: 'Search',
        description: 'Fractional snaps with a search field',
      },
      children: searchWithListContent('snaps'),
    },
    defaultSnap: {
      drawer: { sizing: [0.2, 0.45, 0.7], defaultSnapPoint: 0.45 },
      children: baseContent('Opens at middle (defaultSnapPoint=0.45)', [
        <p key="1" className="text-sm text-zinc-600">
          Close and re-open: intro animation should target the default stop.
        </p>,
      ]),
    },
    notDismissible: {
      drawer: { sizing: [0.35, 0.65], dismissible: false },
      children: baseContent('Cannot drag-dismiss', [
        <p key="1" className="text-sm text-zinc-600">
          Dragging below the lowest snap should not close the panel. Use the bar
          below.
        </p>,
        <button
          key="2"
          type="button"
          onClick={onRequestClose}
          className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white"
        >
          Close drawer
        </button>,
      ]),
    },
    nonModal: {
      drawer: { modal: false, sizing: DRAWER_SIZING.AUTO },
      children: baseContent(
        'Non-modal (no dimmer, no body lock by default pattern)',
        [
          <p key="1" className="text-sm text-zinc-600">
            The page behind stays interactive. Click the scenario list or scroll
            the page to verify. Drag the handle area to resize.
          </p>,
        ],
      ),
    },
    topInset0: {
      drawer: { topInsetPx: 0, sizing: [0.35, 0.65, 0.92] },
      children: baseContent('topInsetPx = 0', [
        <p key="1" className="text-sm text-zinc-600">
          Full viewport height is available for snap math (no map chrome
          offset). Compare to other cases (default 96px inset).
        </p>,
      ]),
    },
    a11yTitle: {
      drawer: {
        title: 'Accessible title for screen readers',
        description: 'Optional description string linked to the dialog.',
        sizing: [0.4, 0.7],
      },
      children: baseContent('Visually plain content', [
        <p key="1" className="text-sm text-zinc-600">
          Title/description are in the DOM (screen-reader only by default; check
          with VoiceOver or DevTools a11y tree).
        </p>,
      ]),
    },
  }
  return cases[id]
}

export function PlaygroundApp() {
  const [log, setLog] = useState<LogLine[]>([])
  const [scenario, setScenario] = useState<ScenarioId | null>(null)
  const [open, setOpen] = useState(false)

  const pushLog = useCallback((text: string) => {
    setLog((prev) => [{ t: Date.now(), text }, ...prev].slice(0, 25))
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (!next) {
        setScenario(null)
        pushLog('onOpenChange(false)')
      }
    },
    [pushLog],
  )

  const openScenario = (id: ScenarioId) => {
    setScenario(id)
    setOpen(true)
    pushLog(`open scenario: ${id}`)
  }

  const onSnapPointChange = useCallback(
    (p: SnapPointValue, i: number) => {
      pushLog(`onSnapPointChange: raw=${p} index=${i}`)
    },
    [pushLog],
  )

  const onDragEnd: DrawerProps['onDragEnd'] = useCallback(
    (
      _e: Parameters<NonNullable<DrawerProps['onDragEnd']>>[0],
      info: DragEndInfo,
    ) => {
      pushLog(
        `onDragEnd: target=${String(info.targetSnapPoint)} v=${info.velocity.toFixed(0)}`,
      )
    },
    [pushLog],
  )

  const renderStandardDrawer = () => {
    if (scenario == null) return null
    if (scenario === 'imperative') {
      return (
        <ImperativeDemo
          open={open}
          onOpenChange={handleOpenChange}
          onLog={pushLog}
        />
      )
    }
    if (scenario === 'controlledSnap') {
      return (
        <ControlledSnapDemo
          open={open}
          onOpenChange={handleOpenChange}
          onLog={pushLog}
        />
      )
    }
    if (scenario === 'autoLoading') {
      return (
        <AutoLoadingDemo
          open={open}
          onOpenChange={handleOpenChange}
          onLog={pushLog}
        />
      )
    }
    if (scenario === 'snapsLoadingTallerThanContent') {
      return (
        <SnapsLoadingTallerThanContentDemo
          open={open}
          onOpenChange={handleOpenChange}
          onLog={pushLog}
        />
      )
    }
    const { drawer: d, children } = getScenarioDrawer(scenario, () =>
      handleOpenChange(false),
    )
    return (
      <Drawer
        key={scenario}
        open={open}
        onOpenChange={handleOpenChange}
        {...d}
        onSnapPointChange={onSnapPointChange}
        onDragEnd={onDragEnd}
        onAnimationComplete={(p) => pushLog(`onAnimationComplete: ${p}`)}
      >
        {children}
      </Drawer>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 pb-48">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Drawer playground
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manual test matrix for{' '}
          <code className="text-zinc-800">@present-day/drawer</code>. Open a
          case, then drag the sheet, handle, and scroll areas. Events appear in
          the log below.
        </p>
      </header>
      <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        <Panel
          title="AUTO — short content"
          description="Intrinsic height; should match a small block of text."
          onOpen={() => openScenario('autoShort')}
        />
        <Panel
          title="AUTO — long scrollable list"
          description="Drawer.Scrollable with many rows; content measurement and inner scroll."
          onOpen={() => openScenario('autoLong')}
        />
        <Panel
          title="AUTO — search + list (iOS keyboard)"
          description="Search field at the top: test soft keyboard with AUTO height and visual viewport."
          onOpen={() => openScenario('autoSearch')}
        />
        <Panel
          title="Snaps + search (compare)"
          description="Same search UI with [0.45, 0.75, 0.96] stops — compare to the AUTO search case on mobile."
          onOpen={() => openScenario('snapsSearch')}
        />
        <Panel
          title="AUTO — loading then taller"
          description="Two-line skeleton for ~1.5s, then more copy; sheet height should follow."
          onOpen={() => openScenario('autoLoading')}
        />
        <Panel
          title="Mixed: AUTO + pixel + FULL snaps"
          description="sizing=[AUTO, 480, FULL] with a skeleton→taller content swap. AUTO slot tracks measured content; 480/FULL stay above it."
          onOpen={() => openScenario('snapsLoadingTallerThanContent')}
        />
        <Panel
          title="FULL"
          description="Single snap at available height; scroll inside if content is tall."
          onOpen={() => openScenario('full')}
        />
        <Panel
          title="Fraction snaps"
          description="SNAP_POINT.PEEK, HALF, MAX — mix of px peek and ratios."
          onOpen={() => openScenario('snapsFractions')}
        />
        <Panel
          title="Pixel snaps"
          description="[140, 300, 480] — values &gt; 1 are pixel heights."
          onOpen={() => openScenario('snapsPixels')}
        />
        <Panel
          title="defaultSnapPoint"
          description="Opens to the middle stop (0.45) of [0.2,0.45,0.7]."
          onOpen={() => openScenario('defaultSnap')}
        />
        <Panel
          title="Not dismissible"
          description="dismissible=false; cannot fling/drag to close. Use Close in the sheet."
          onOpen={() => openScenario('notDismissible')}
        />
        <Panel
          title="Non-modal"
          description="modal=false; no dimmer — interact with this page while open."
          onOpen={() => openScenario('nonModal')}
        />
        <Panel
          title="topInsetPx = 0"
          description="No top offset for snap math — taller usable stops vs default 96px."
          onOpen={() => openScenario('topInset0')}
        />
        <Panel
          title="title + description a11y"
          description="Screen-reader label props on the root dialog (inspect in a11y tree)."
          onOpen={() => openScenario('a11yTitle')}
        />
        <Panel
          title="Imperative ref"
          description="snapTo, expand, collapse, dismiss, getHeight, getActiveSnapPoint."
          onOpen={() => openScenario('imperative')}
        />
        <Panel
          title="Controlled active snap"
          description="Parent-owned activeSnapPoint with buttons to jump between stops."
          onOpen={() => openScenario('controlledSnap')}
        />
      </ul>
      {renderStandardDrawer()}
      <section
        className="pointer-events-auto fixed bottom-0 left-0 right-0 max-h-40 overflow-y-auto border-t border-zinc-200 bg-zinc-50/95 p-2 text-left shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur"
        aria-label="Event log"
      >
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Event log
        </h2>
        {log.length === 0 ? (
          <p className="px-1 text-xs text-zinc-500">No events yet.</p>
        ) : (
          <ol className="m-0 list-decimal p-0 pl-5 font-mono text-[11px] text-zinc-800">
            {log.map((line) => (
              <li key={`${line.t}-${line.text}`} className="py-0.5">
                {line.text}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
