import { type ReactNode, StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ScrollDrawer } from '../src/components/scroll/ScrollDrawer'

const PLACES = [
  {
    name: 'Corner Pocket Billiards',
    address: '412 Halsted St, Chicago, IL',
    tables: 14,
  },
  {
    name: 'The Rack Room',
    address: '88 W Division St, Chicago, IL',
    tables: 9,
  },
  {
    name: 'Eight Ball Social',
    address: '2150 N Milwaukee Ave, Chicago, IL',
    tables: 6,
  },
  {
    name: 'Felt & Chalk',
    address: '1720 W Belmont Ave, Chicago, IL',
    tables: 12,
  },
  {
    name: 'Side Pocket Tavern',
    address: '3301 N Clark St, Chicago, IL',
    tables: 4,
  },
  {
    name: 'Bank Shot Bar',
    address: '615 S Wabash Ave, Chicago, IL',
    tables: 5,
  },
  {
    name: 'Lakeview Cue Club',
    address: '2934 N Broadway, Chicago, IL',
    tables: 18,
  },
  {
    name: 'Break & Run Lounge',
    address: '1459 W Taylor St, Chicago, IL',
    tables: 8,
  },
  { name: 'The Cushion', address: '901 W Randolph St, Chicago, IL', tables: 3 },
  {
    name: 'Velvet Rail Billiards',
    address: '4410 N Lincoln Ave, Chicago, IL',
    tables: 10,
  },
  {
    name: 'Nine Ball Annex',
    address: '2210 S Halsted St, Chicago, IL',
    tables: 7,
  },
  {
    name: 'Diamond Table Pub',
    address: '1607 N Damen Ave, Chicago, IL',
    tables: 2,
  },
  {
    name: 'Cue Street Hall',
    address: '5110 N Clark St, Chicago, IL',
    tables: 16,
  },
  {
    name: 'Chalk Line Saloon',
    address: '738 N Wells St, Chicago, IL',
    tables: 4,
  },
  {
    name: 'Pocket Change',
    address: '3159 W Logan Blvd, Chicago, IL',
    tables: 6,
  },
  { name: 'Rail & Rack', address: '1925 W Cermak Rd, Chicago, IL', tables: 11 },
  {
    name: 'Straight Pool Society',
    address: '2702 N Lincoln Ave, Chicago, IL',
    tables: 8,
  },
  {
    name: 'The Long Rail',
    address: '6420 N Sheridan Rd, Chicago, IL',
    tables: 5,
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

function SearchSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
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
      snapPoints={[300, 520]}
      dismissible={false}
      className="cq-sheet"
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
                <button type="button" className="cq-row">
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

function App() {
  const [open, setOpen] = useState(true)
  return (
    <main className="cq-map" aria-label="Map">
      <span className="cq-pin" style={{ left: '22%', top: '18%' }} />
      <span className="cq-pin" style={{ left: '64%', top: '12%' }} />
      <span className="cq-pin" style={{ left: '48%', top: '31%' }} />
      <span className="cq-pin" style={{ left: '78%', top: '38%' }} />
      <span className="cq-pin" style={{ left: '30%', top: '44%' }} />
      {open ? null : (
        <button type="button" className="cq-open" onClick={() => setOpen(true)}>
          <Icon d={SEARCH} />
          Search
        </button>
      )}
      <SearchSheet open={open} onClose={() => setOpen(false)} />
    </main>
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
