import { supportsScrollTimeline } from './geometry'

/**
 * Open stacking drawers, back to front. Each one names its scroll timeline
 * uniquely and hoists it to `html` with `timeline-scope`, so a drawer behind
 * can run one recede animation per drawer in front of it, each driven by that
 * drawer's own swipe. `animation-composition: accumulate` adds them up, so two
 * drawers in front make a drawer recede twice as far.
 */
export type StackEntry = {
  name: string
  scroller: HTMLElement
  /**
   * Scroll range over which this drawer covers the ones behind it, in
   * `scrollTop` px: closed to its lowest stop. Empty for a pinned drawer,
   * which has no closed scroll position, so the ones behind recede on a timer.
   */
  range: { start: number; end: number }
}

const entries: StackEntry[] = []
let scopeBefore: string | null = null

const STACK_TIMING = {
  duration: '300ms',
  easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
}

function applyBehind(entry: StackEntry, front: StackEntry[]) {
  const s = entry.scroller.style
  if (front.length === 0) {
    for (const p of [
      'animation-name',
      'animation-duration',
      'animation-timing-function',
      'animation-fill-mode',
      'animation-timeline',
      'animation-range',
      'animation-composition',
    ]) {
      s.removeProperty(p)
    }
    return
  }
  const scrollDriven = supportsScrollTimeline()
  const each = front.map((f) => {
    const driven = scrollDriven && f.range.end > f.range.start
    return {
      timeline: driven ? f.name : 'auto',
      range: driven ? `${f.range.start}px ${f.range.end}px` : 'normal',
      duration: driven ? 'auto' : STACK_TIMING.duration,
      easing: driven ? 'linear' : STACK_TIMING.easing,
    }
  })
  const list = (pick: (e: (typeof each)[number]) => string) =>
    each.map(pick).join(', ')
  s.setProperty(
    'animation-name',
    each.map(() => 'scroll-drawer-stack').join(', '),
  )
  s.setProperty(
    'animation-duration',
    list((e) => e.duration),
  )
  s.setProperty(
    'animation-timing-function',
    list((e) => e.easing),
  )
  s.setProperty('animation-fill-mode', each.map(() => 'both').join(', '))
  s.setProperty(
    'animation-timeline',
    list((e) => e.timeline),
  )
  s.setProperty(
    'animation-range',
    list((e) => e.range),
  )
  s.setProperty(
    'animation-composition',
    each.map(() => 'accumulate').join(', '),
  )
}

function sync() {
  const root = document.documentElement.style
  if (entries.length > 0) {
    if (scopeBefore === null)
      scopeBefore = root.getPropertyValue('timeline-scope')
    root.setProperty('timeline-scope', entries.map((e) => e.name).join(', '))
  } else if (scopeBefore !== null) {
    if (scopeBefore) root.setProperty('timeline-scope', scopeBefore)
    else root.removeProperty('timeline-scope')
    scopeBefore = null
  }
  entries.forEach((e, i) => {
    applyBehind(e, entries.slice(i + 1))
  })
}

/** Adds a drawer to the top of the stack. Returns an update and a leave. */
export function joinStack(entry: StackEntry): {
  update: (range: StackEntry['range']) => void
  leave: () => void
} {
  entries.push(entry)
  sync()
  return {
    update: (range) => {
      if (range.start === entry.range.start && range.end === entry.range.end) {
        return
      }
      entry.range = range
      sync()
    },
    leave: () => {
      const i = entries.indexOf(entry)
      if (i === -1) return
      entries.splice(i, 1)
      applyBehind(entry, [])
      sync()
    },
  }
}
