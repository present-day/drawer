import { type ReactNode, useCallback, useMemo, useState } from 'react'
import {
  Drawer,
  type DrawerProps,
  type DrawerSlots,
  type SnapPoint,
} from '../src'

// The package ships Drawer.Content bare (shadcn-style), so consumers pick a
// surface color. Stories use the theme-aware demo surface so every scenario is
// readable in light and dark without repeating the className.
export const demoSlots: DrawerSlots = { contentClassName: 'bg-surface text-fg' }

const LONG_ITEMS = Array.from({ length: 45 }, (_, i) => i + 1)
const SEARCH_RESULTS = Array.from({ length: 20 }, (_, i) => i + 1)

type LogLine = { t: number; text: string }

/** Newest-first event log, capped at 25 lines. */
export function useEventLog() {
  const [lines, setLines] = useState<LogLine[]>([])
  const push = useCallback((text: string) => {
    setLines((prev) => [{ t: Date.now(), text }, ...prev].slice(0, 25))
  }, [])
  return { lines, push }
}

/**
 * The callbacks every story logs, so drag, snap, and animation events show up
 * in the in-page log (visible on a phone, where the addon panels are not).
 */
export function useLoggedCallbacks(push: (text: string) => void) {
  return useMemo(
    () =>
      ({
        onSnapPointChange: (point: SnapPoint, index: number) =>
          push(`onSnapPointChange: raw=${point} index=${index}`),
        onDragEnd: (_event, info) =>
          push(
            `onDragEnd: target=${String(info.targetSnapPoint)} v=${info.velocity.toFixed(0)}`,
          ),
        onAnimationComplete: (point: SnapPoint) =>
          push(`onAnimationComplete: ${String(point)}`),
      }) satisfies Pick<
        DrawerProps,
        'onSnapPointChange' | 'onDragEnd' | 'onAnimationComplete'
      >,
    [push],
  )
}

/**
 * Open state for a story. Stories start open so a standalone
 * `iframe.html?id=…` URL shows the drawer straight away on a phone.
 */
export function useDemoOpen(push: (text: string) => void, initial = true) {
  const [open, setOpen] = useState(initial)
  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      push(`onOpenChange(${next})`)
    },
    [push],
  )
  return { open, setOpen, onOpenChange }
}

export function DemoPage({
  title,
  description,
  onOpen,
  log,
  logBottomPx = 0,
  children,
}: {
  title: string
  description: ReactNode
  onOpen: () => void
  log: LogLine[]
  /** Lifts the event log, e.g. above a fixed bottom nav bar. */
  logBottomPx?: number
  children?: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl pb-48">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </header>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90"
      >
        Open drawer
      </button>
      {children}
      <EventLog lines={log} bottomPx={logBottomPx} />
    </div>
  )
}

function EventLog({ lines, bottomPx }: { lines: LogLine[]; bottomPx: number }) {
  return (
    <section
      style={{ bottom: bottomPx }}
      className="pointer-events-auto fixed bottom-0 left-0 right-0 max-h-40 overflow-y-auto border-t border-line bg-subtle p-2 text-left shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
      aria-label="Event log"
    >
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        Event log
      </h2>
      {lines.length === 0 ? (
        <p className="px-1 text-xs text-muted">No events yet.</p>
      ) : (
        <ol className="m-0 list-decimal p-0 pl-5 font-mono text-[11px] text-fg">
          {lines.map((line) => (
            <li key={`${line.t}-${line.text}`} className="py-0.5">
              {line.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function BaseContent({
  heading,
  children,
}: {
  heading: ReactNode
  children?: ReactNode
}) {
  return (
    <Drawer.Content>
      <Drawer.Handle />
      <div className="px-4 pb-5 pt-0">
        <h3 className="mb-2 text-sm font-medium">{heading}</h3>
        {children}
      </div>
    </Drawer.Content>
  )
}

export function BodyText({ children }: { children: ReactNode }) {
  return <p className="text-sm opacity-75">{children}</p>
}

export function LongScrollableContent({
  scrollableClassName,
}: {
  scrollableClassName?: string
}) {
  return (
    <Drawer.Content>
      <Drawer.Handle />
      <Drawer.Scrollable className={scrollableClassName ?? 'px-4 pb-5'}>
        <p className="mb-2 text-sm text-muted">
          Scroll inside the panel. Drag the sheet (outside this list) to resize
          or dismiss.
        </p>
        <ul className="space-y-2">
          {LONG_ITEMS.map((n) => (
            <li
              key={n}
              className="rounded-lg border border-line bg-subtle px-3 py-2 text-sm"
            >
              List row {n}
            </li>
          ))}
        </ul>
      </Drawer.Scrollable>
    </Drawer.Content>
  )
}

/**
 * Search field + list: use on iOS Safari to see AUTO height and visual-viewport
 * anchoring when the soft keyboard is up.
 */
export function SearchWithListContent({ kind }: { kind: 'auto' | 'snaps' }) {
  const id = `story-search-${kind}`
  return (
    <Drawer.Content>
      <Drawer.Handle />
      <div className="px-4 pt-0">
        <h3 className="mb-2 text-sm font-medium text-fg">
          {kind === 'auto' ? 'Search (AUTO height)' : 'Search (snap heights)'}
        </h3>
        <p className="mb-3 text-sm text-muted">
          {kind === 'auto' ? (
            <>
              Focus the field to show the on-screen keyboard. With{' '}
              <code className="text-fg">snapPoints=['auto']</code>, height
              follows content and the sheet should stay aligned above the
              keyboard.
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
          <span className="text-xs font-medium text-muted">Query</span>
          <input
            id={id}
            name={id}
            type="search"
            enterKeyHint="search"
            placeholder="Type to test the keyboard…"
            autoComplete="off"
            autoCapitalize="off"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-fg shadow-sm outline-none focus:ring-2 focus:ring-zinc-400/40"
          />
        </label>
      </div>
      <Drawer.Scrollable className="px-4 pb-5">
        <p className="mb-2 text-xs text-muted">
          Scroll the list in the sheet; drag the handle area (not the field) to
          resize the drawer.
        </p>
        <ul className="space-y-2">
          {SEARCH_RESULTS.map((n) => (
            <li
              key={n}
              className="rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-muted"
            >
              Sample result {n}
            </li>
          ))}
        </ul>
      </Drawer.Scrollable>
    </Drawer.Content>
  )
}

/** Pulsing placeholder lines shown while simulated content "loads". */
export function Skeleton({ widths }: { widths: string[] }) {
  return (
    <div
      className="space-y-2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {widths.map((w) => (
        <div
          key={w}
          className={`h-3 ${w} animate-pulse rounded bg-zinc-400/30`}
        />
      ))}
    </div>
  )
}
