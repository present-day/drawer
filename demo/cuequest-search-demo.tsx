import {
  type ReactNode,
  StrictMode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createRoot } from 'react-dom/client'
import { ScrollDrawer } from '../src/components/scroll/ScrollDrawer'

const PLACES = [
  {
    name: 'Corner Pocket Billiards',
    address: '412 Halsted St, Chicago, IL',
    tables: 14,
    x: 420,
    y: 560,
  },
  {
    name: 'The Rack Room',
    address: '88 W Division St, Chicago, IL',
    tables: 9,
    x: 700,
    y: 300,
  },
  {
    name: 'Eight Ball Social',
    address: '2150 N Milwaukee Ave, Chicago, IL',
    tables: 6,
    x: 380,
    y: 250,
  },
  {
    name: 'Felt & Chalk',
    address: '1720 W Belmont Ave, Chicago, IL',
    tables: 12,
    x: 540,
    y: 180,
  },
  {
    name: 'Side Pocket Tavern',
    address: '3301 N Clark St, Chicago, IL',
    tables: 4,
    x: 760,
    y: 140,
  },
  {
    name: 'Bank Shot Bar',
    address: '615 S Wabash Ave, Chicago, IL',
    tables: 5,
    x: 880,
    y: 720,
  },
  {
    name: 'Lakeview Cue Club',
    address: '2934 N Broadway, Chicago, IL',
    tables: 18,
    x: 820,
    y: 200,
  },
  {
    name: 'Break & Run Lounge',
    address: '1459 W Taylor St, Chicago, IL',
    tables: 8,
    x: 560,
    y: 760,
  },
  {
    name: 'The Cushion',
    address: '901 W Randolph St, Chicago, IL',
    tables: 3,
    x: 640,
    y: 540,
  },
  {
    name: 'Velvet Rail Billiards',
    address: '4410 N Lincoln Ave, Chicago, IL',
    tables: 10,
    x: 470,
    y: 110,
  },
  {
    name: 'Nine Ball Annex',
    address: '2210 S Halsted St, Chicago, IL',
    tables: 7,
    x: 600,
    y: 980,
  },
  {
    name: 'Diamond Table Pub',
    address: '1607 N Damen Ave, Chicago, IL',
    tables: 2,
    x: 330,
    y: 380,
  },
  {
    name: 'Cue Street Hall',
    address: '5110 N Clark St, Chicago, IL',
    tables: 16,
    x: 860,
    y: 60,
  },
  {
    name: 'Chalk Line Saloon',
    address: '738 N Wells St, Chicago, IL',
    tables: 4,
    x: 820,
    y: 470,
  },
  {
    name: 'Pocket Change',
    address: '3159 W Logan Blvd, Chicago, IL',
    tables: 6,
    x: 240,
    y: 330,
  },
  {
    name: 'Rail & Rack',
    address: '1925 W Cermak Rd, Chicago, IL',
    tables: 11,
    x: 300,
    y: 940,
  },
  {
    name: 'Straight Pool Society',
    address: '2702 N Lincoln Ave, Chicago, IL',
    tables: 8,
    x: 500,
    y: 280,
  },
  {
    name: 'The Long Rail',
    address: '6420 N Sheridan Rd, Chicago, IL',
    tables: 5,
    x: 1000,
    y: 40,
  },
]

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

function Icon({ d, className }: { d: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {d}
    </svg>
  )
}

const PIN = (
  <>
    <path d="M18 8c0 3.6-4 7.6-5.4 8.9a1 1 0 0 1-1.2 0C10 15.6 6 11.6 6 8a6 6 0 0 1 12 0" />
    <circle cx="12" cy="8" r="2" />
    <path d="M8.7 14.3 4 16l8 6 8-6-4.7-1.7" />
  </>
)
const SEARCH = (
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>
)
const CHEVRON = <path d="m9 18 6-6-6-6" />
const X = <path d="M18 6 6 18M6 6l12 12" />

type Layout = 'full' | 'centered'
type Mode = 'modeless' | 'modal'
type Place = (typeof PLACES)[number]

const WORLD = { width: 1200, height: 1100 }
const MIN_ZOOM = 0.5
const MAX_ZOOM = 8
const SHORE =
  'M1090 0 C1060 140 1120 260 1080 380 S1040 600 1100 720 S1060 960 1110 1100 L1200 1100 L1200 0 Z'
const RIVER = 'M0 470 C200 450 420 520 640 500 S860 430 1092 455'
const RIVER_BRANCH = 'M640 500 C600 640 520 760 470 1100'
const AVENUES = [
  'M640 500 L120 0',
  'M700 480 L380 0',
  'M760 470 L1040 0',
  'M640 520 L60 1100',
]
const PARKS = [
  { x: 960, y: 120, w: 90, h: 260 },
  { x: 220, y: 700, w: 140, h: 120 },
  { x: 720, y: 820, w: 110, h: 90 },
]

type View = { x: number; y: number; k: number }

const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))

// The transform is written straight to the DOM: React re-rendering the map on
// every wheel notch would compete with the drawer for the main thread.
function CityMap({
  selected,
  bottomInset,
  children,
}: {
  selected: Place | null
  bottomInset: number
  children?: ReactNode
}) {
  const mapRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<HTMLOutputElement>(null)
  const view = useRef<View>({ x: 0, y: 0, k: 1 })

  const apply = (animate = false) => {
    const world = worldRef.current
    if (!world) return
    const { x, y, k } = view.current
    world.style.transition = animate
      ? 'transform 450ms cubic-bezier(0.32, 0.72, 0, 1)'
      : ''
    world.style.transform = `translate(${x}px, ${y}px) scale(${k})`
    world.style.setProperty('--k', String(k))
    if (zoomRef.current) zoomRef.current.textContent = `${Math.round(k * 100)}%`
  }

  const zoomAt = (px: number, py: number, factor: number, animate = false) => {
    const v = view.current
    const k = clampZoom(v.k * factor)
    const f = k / v.k
    view.current = { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f }
    apply(animate)
  }

  useLayoutEffect(() => {
    const map = mapRef.current
    if (!map) return
    const k = Math.max(
      map.clientWidth / WORLD.width,
      map.clientHeight / WORLD.height,
    )
    view.current = {
      k,
      x: (map.clientWidth - WORLD.width * k) / 2,
      y: (map.clientHeight - WORLD.height * k) / 2,
    }
    apply()
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = map.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1
      // Pinch on a trackpad arrives as ctrl+wheel with small deltas.
      const rate = e.ctrlKey || e.metaKey ? 0.01 : 0.002
      zoomAt(px, py, Math.exp(-e.deltaY * unit * rate))
    }

    const pointers = new Map<number, { x: number; y: number }>()
    let pinch: { d: number } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as Element).closest('button')) return
      map.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      map.dataset.dragging = ''
    }
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const next = { x: e.clientX, y: e.clientY }
      pointers.set(e.pointerId, next)
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        if (!a || !b) return
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const rect = map.getBoundingClientRect()
        if (pinch) {
          zoomAt(
            (a.x + b.x) / 2 - rect.left,
            (a.y + b.y) / 2 - rect.top,
            d / pinch.d,
          )
        }
        pinch = { d }
        return
      }
      view.current.x += next.x - prev.x
      view.current.y += next.y - prev.y
      apply()
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      pinch = null
      if (pointers.size === 0) delete map.dataset.dragging
    }
    map.addEventListener('wheel', onWheel, { passive: false })
    map.addEventListener('pointerdown', onDown)
    map.addEventListener('pointermove', onMove)
    map.addEventListener('pointerup', onUp)
    map.addEventListener('pointercancel', onUp)
    return () => {
      map.removeEventListener('wheel', onWheel)
      map.removeEventListener('pointerdown', onDown)
      map.removeEventListener('pointermove', onMove)
      map.removeEventListener('pointerup', onUp)
      map.removeEventListener('pointercancel', onUp)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!selected || !map) return
    const k = Math.max(view.current.k, 2.5)
    const visible = map.clientHeight - bottomInset
    view.current = {
      k,
      x: map.clientWidth / 2 - selected.x * k,
      y: Math.max(visible, 120) / 2 - selected.y * k,
    }
    apply(true)
  }, [selected, bottomInset])

  const zoomCenter = (factor: number) => {
    const map = mapRef.current
    if (!map) return
    zoomAt(
      map.clientWidth / 2,
      (map.clientHeight - bottomInset) / 2,
      factor,
      true,
    )
  }

  return (
    <main ref={mapRef} className="cq-map" aria-label="Map">
      <div ref={worldRef} className="cq-world">
        <svg
          width={WORLD.width}
          height={WORLD.height}
          viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
          aria-hidden
        >
          <defs>
            <pattern
              id="cq-grid"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path d="M80 0H0V80" className="cq-street-minor" />
            </pattern>
          </defs>
          <rect width={WORLD.width} height={WORLD.height} className="cq-land" />
          <rect
            width={WORLD.width}
            height={WORLD.height}
            fill="url(#cq-grid)"
          />
          {[160, 400, 640, 880].map((y) => (
            <path
              key={`h${y}`}
              d={`M0 ${y}H${WORLD.width}`}
              className="cq-street-major"
            />
          ))}
          {[160, 320, 560, 800].map((x) => (
            <path
              key={`v${x}`}
              d={`M${x} 0V${WORLD.height}`}
              className="cq-street-major"
            />
          ))}
          {AVENUES.map((d) => (
            <path key={d} d={d} className="cq-street-major" />
          ))}
          {PARKS.map((p) => (
            <rect
              key={`${p.x},${p.y}`}
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx="8"
              className="cq-park"
            />
          ))}
          <path d={RIVER} className="cq-river" />
          <path d={RIVER_BRANCH} className="cq-river" />
          <path d={SHORE} className="cq-water" />
        </svg>
        {PLACES.map((p) => (
          <span
            key={p.name}
            className="cq-pin"
            data-selected={selected?.name === p.name ? '' : undefined}
            style={{ left: p.x, top: p.y }}
            title={p.name}
          />
        ))}
      </div>
      <div className="cq-zoom">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomCenter(1.5)}
        >
          +
        </button>
        <output ref={zoomRef} aria-live="polite" />
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomCenter(1 / 1.5)}
        >
          −
        </button>
      </div>
      {children}
    </main>
  )
}

function SearchSheet({
  open,
  onClose,
  layout,
  mode,
  selected,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  layout: Layout
  mode: Mode
  selected: Place | null
  onSelect: (place: Place) => void
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? PLACES.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.address.toLowerCase().includes(q),
        )
      : PLACES
  }, [query])

  return (
    <ScrollDrawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      snapPoints={[PEEK, 520]}
      dismissible={false}
      contentScroll="always"
      modal={mode === 'modal'}
      className={
        layout === 'centered' ? 'cq-sheet cq-sheet-centered' : 'cq-sheet'
      }
      aria-labelledby="cq-search-title"
    >
      <ScrollDrawer.Handle />
      <header className="cq-header">
        <h2 id="cq-search-title">Search</h2>
        <label className="cq-input">
          <Icon d={SEARCH} className="cq-input-icon" />
          <span className="sr-only">Search places</span>
          <input
            name="search"
            type="search"
            autoComplete="off"
            placeholder="Find places in Chicago"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="cq-clear"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <Icon d={X} />
            </button>
          ) : null}
        </label>
      </header>
      <ScrollDrawer.Content className="cq-results">
        {results.length ? (
          <ul>
            {results.map((p) => (
              <li key={p.name}>
                <button
                  type="button"
                  className="cq-row"
                  aria-pressed={selected?.name === p.name}
                  onClick={() => onSelect(p)}
                >
                  <span className="cq-row-icon">
                    <Icon d={PIN} />
                  </span>
                  <span className="cq-row-text">
                    <span className="cq-row-name">
                      <Highlight text={p.name} query={query} />
                    </span>
                    <span className="cq-row-address">
                      <Highlight text={p.address} query={query} />
                    </span>
                  </span>
                  <span className="cq-row-tables">{p.tables} tables</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cq-empty">No saved places match “{query.trim()}”.</p>
        )}
      </ScrollDrawer.Content>
      <footer className="cq-footer">
        <button type="button" className="cq-add">
          <span className="cq-add-icon">
            <Icon d={PIN} />
          </span>
          <span className="cq-add-text">
            <span className="cq-add-title">Add a new place</span>
            <span className="cq-add-sub">
              {query.trim()
                ? `Search Google Places for "${query.trim()}"`
                : 'Search Google Places for a venue not on the map yet'}
            </span>
          </span>
          <Icon d={CHEVRON} className="cq-chevron" />
        </button>
        <button type="button" className="cq-close" onClick={onClose}>
          Close
        </button>
      </footer>
    </ScrollDrawer>
  )
}

function Segmented<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string
  name: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="cq-segmented">
      <legend className="sr-only">{label}</legend>
      {options.map(([v, text]) => (
        <label key={v}>
          <input
            type="radio"
            name={name}
            id={`${name}-${v}`}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
          />
          {text}
        </label>
      ))}
    </fieldset>
  )
}

const PEEK = 300

function App() {
  const [open, setOpen] = useState(true)
  const [layout, setLayout] = useState<Layout>('centered')
  const [mode, setMode] = useState<Mode>('modeless')
  const [selected, setSelected] = useState<Place | null>(null)
  return (
    <>
      <div className="cq-controls">
        <Segmented
          label="Drawer layout"
          name="layout"
          value={layout}
          onChange={setLayout}
          options={[
            ['full', 'Full width'],
            ['centered', 'Centered'],
          ]}
        />
        <Segmented
          label="Drawer modality"
          name="mode"
          value={mode}
          onChange={setMode}
          options={[
            ['modeless', 'Map usable'],
            ['modal', 'Modal'],
          ]}
        />
      </div>
      <CityMap selected={selected} bottomInset={open ? PEEK : 0}>
        {open ? null : (
          <button
            type="button"
            className="cq-open"
            onClick={() => setOpen(true)}
          >
            <Icon d={SEARCH} />
            Search
          </button>
        )}
      </CityMap>
      <SearchSheet
        open={open}
        onClose={() => setOpen(false)}
        layout={layout}
        mode={mode}
        selected={selected}
        onSelect={setSelected}
      />
    </>
  )
}

const host =
  document.getElementById('root') ??
  document.body.appendChild(document.createElement('div'))
createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
