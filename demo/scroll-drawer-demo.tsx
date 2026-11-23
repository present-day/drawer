import { type ReactNode, StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Drawer, LegacyDrawer } from '../src'

// The existing Drawer's panel and parts carry Tailwind utilities that this
// Tailwind-free bundle never generates, so the few it relies on are restated.
const CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
body {
  font: 16px/1.4 system-ui, -apple-system, sans-serif;
  background: #f2f2f5; color: #111; min-height: 100dvh;
  -webkit-text-size-adjust: 100%;
}
.demo { padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); max-width: 720px; margin: 0 auto; }
.demo h1 { font-size: 20px; margin: 0 0 4px; padding-right: 150px; }
.demo p { margin: 0 0 16px; color: #555; font-size: 14px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.grid h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #666; margin: 8px 0 0; }
.grid button {
  font: inherit; font-size: 14px; padding: 12px 8px; border-radius: 12px;
  border: 1px solid #d0d0d8; background: #fff; color: inherit;
}
.fps {
  position: fixed; top: max(8px, env(safe-area-inset-top)); right: 8px; z-index: 100;
  font: 12px/1.2 ui-monospace, monospace; background: #111; color: #0f0;
  padding: 6px 8px; border-radius: 8px; pointer-events: none; text-align: right;
}
.fps small { display: block; color: #9a9; }
.sheet-body { padding: 0 16px 24px; }
.sheet-body h3 { margin: 0 0 8px; }
.sheet-body ul { list-style: none; margin: 0; padding: 0; }
.sheet-body li { padding: 12px 0; border-bottom: 1px solid #eee; }
.sheet-body input {
  width: 100%; font: inherit; padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;
}
.sheet-body .close {
  font: inherit; padding: 8px 12px; border-radius: 10px; border: 1px solid #ccc; background: #fff; margin-bottom: 12px;
}
.legacy-surface { background: #fff; color: #111; }

.fixed { position: fixed; } .relative { position: relative; }
.inset-0 { inset: 0; } .inset-x-0 { left: 0; right: 0; } .z-50 { z-index: 50; }
.flex { display: flex; } .flex-col { flex-direction: column; } .flex-1 { flex: 1 1 0%; }
.shrink-0 { flex-shrink: 0; } .min-h-0 { min-height: 0; } .max-h-dvh { max-height: 100dvh; }
.w-full { width: 100%; } .mx-auto { margin-left: auto; margin-right: auto; }
.pt-3 { padding-top: 12px; } .pb-2 { padding-bottom: 8px; }
.items-center { align-items: center; } .justify-center { justify-content: center; }
.touch-none { touch-action: none; } .touch-manipulation { touch-action: manipulation; } .touch-pan-y { touch-action: pan-y; }
.outline-none { outline: none; } .pointer-events-auto { pointer-events: auto; }
.overscroll-y-none { overscroll-behavior-y: none; } .overflow-y-auto { overflow-y: auto; }
.rounded-t-3xl { border-top-left-radius: 24px; border-top-right-radius: 24px; }
.cursor-grab { cursor: grab; } .bg-black\\/50 { background: rgb(0 0 0 / 0.5); border: 0; padding: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
[data-drawer-handle-indicator] { display: block; height: 4px; width: 100px; border-radius: 9999px; background: rgb(156 163 175 / 0.5); }
`

const ROWS = Array.from({ length: 60 }, (_, i) => `Row ${i + 1}`)
const FILLER = Array.from(
  { length: 30 },
  (_, i) => `Page filler line ${i + 1} to show the body scroll lock.`,
)

type Variant = {
  id: string
  label: string
  snapPoints?: number[]
  dismissible?: boolean
  body: 'basic' | 'long' | 'input'
}

const VARIANTS: Variant[] = [
  { id: 'basic', label: 'Basic', body: 'basic' },
  { id: 'snaps', label: 'Snaps 200/420', snapPoints: [200, 420], body: 'long' },
  {
    id: 'locked',
    label: 'Non-dismissible',
    snapPoints: [200, 420],
    dismissible: false,
    body: 'long',
  },
  { id: 'long', label: 'Long content', body: 'long' },
  { id: 'input', label: 'Input field', body: 'input' },
]

function FpsMeter() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let frames = 0
    let worst = 0
    let last = performance.now()
    let windowStart = last
    let id = requestAnimationFrame(function tick(now) {
      frames++
      worst = Math.max(worst, now - last)
      last = now
      if (now - windowStart >= 500) {
        const fps = (frames * 1000) / (now - windowStart)
        if (ref.current) {
          ref.current.textContent = `${fps.toFixed(0)} fps · worst ${worst.toFixed(0)}ms`
        }
        frames = 0
        worst = 0
        windowStart = now
      }
      id = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div className="fps">
      <span ref={ref}>– fps</span>
      <small>main-thread rAF</small>
    </div>
  )
}

function Body({
  kind,
  onClose,
}: {
  kind: Variant['body']
  onClose?: () => void
}) {
  return (
    <div className="sheet-body">
      {onClose ? (
        <button type="button" className="close" onClick={onClose}>
          Close
        </button>
      ) : null}
      {kind === 'long' ? (
        <ul>
          {ROWS.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      ) : kind === 'input' ? (
        <label>
          <h3>Message</h3>
          <input placeholder="Tap to open the keyboard" />
        </label>
      ) : (
        <>
          <h3>Hello</h3>
          <p>Swipe down to dismiss, or drag the handle.</p>
        </>
      )}
    </div>
  )
}

function EngineVariant({
  variant,
  engine,
  open,
  setOpen,
}: {
  variant: Variant
  engine: 'scroll' | 'legacy'
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const Engine = engine === 'scroll' ? Drawer : LegacyDrawer
  const scrolls = variant.body === 'long'
  const onClose =
    variant.dismissible === false ? () => setOpen(false) : undefined
  return (
    <Engine
      open={open}
      onOpenChange={setOpen}
      snapPoints={
        variant.snapPoints ? [...variant.snapPoints, 'full'] : undefined
      }
      dismissible={variant.dismissible}
      ariaLabel={`${variant.label} (${engine === 'scroll' ? 'v3 scroll' : 'v2 motion'})`}
    >
      <Engine.Content className="legacy-surface">
        <Engine.Handle />
        {scrolls ? (
          <Engine.Scrollable>
            <Body kind={variant.body} onClose={onClose} />
          </Engine.Scrollable>
        ) : (
          <Body kind={variant.body} onClose={onClose} />
        )}
      </Engine.Content>
    </Engine>
  )
}

function App() {
  const [active, setActive] = useState<{
    id: string
    engine: 'scroll' | 'legacy'
  } | null>(null)
  const rows: ReactNode[] = []
  for (const v of VARIANTS) {
    rows.push(
      <button
        key={`${v.id}-scroll`}
        type="button"
        onClick={() => setActive({ id: v.id, engine: 'scroll' })}
      >
        {v.label}
      </button>,
      <button
        key={`${v.id}-legacy`}
        type="button"
        onClick={() => setActive({ id: v.id, engine: 'legacy' })}
      >
        {v.label}
      </button>,
    )
  }
  return (
    <main className="demo">
      <FpsMeter />
      <h1>Drawer v3 vs v2</h1>
      <p>
        Left column: v3 scroll-snap engine (native, compositor-driven). Right
        column: v2 motion-driven Drawer. Both get identical props. The meter
        counts JS frames, so a smooth native swipe can look smooth even while it
        reads 60.
      </p>
      <div className="grid">
        <h2>v3 scroll engine</h2>
        <h2>v2 motion engine</h2>
        {rows}
      </div>
      {FILLER.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {VARIANTS.map((v) => {
        const isScroll = active?.id === v.id && active.engine === 'scroll'
        const isLegacy = active?.id === v.id && active.engine === 'legacy'
        const close = (open: boolean) => {
          if (!open) setActive(null)
        }
        return (
          <div key={v.id}>
            <EngineVariant
              variant={v}
              engine="scroll"
              open={isScroll}
              setOpen={close}
            />
            <EngineVariant
              variant={v}
              engine="legacy"
              open={isLegacy}
              setOpen={close}
            />
          </div>
        )
      })}
    </main>
  )
}

function boot() {
  if (!document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement('meta')
    meta.name = 'viewport'
    meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover'
    document.head.appendChild(meta)
  }
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  const host = document.createElement('div')
  document.body.appendChild(host)
  createRoot(host).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}
