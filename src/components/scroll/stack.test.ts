import { afterEach, describe, expect, it, vi } from 'vitest'
import { joinStack as joinStackUnsafe } from './stack'

const leaves: (() => void)[] = []
/** Joins, and leaves in `afterEach` even if the test fails first. */
function joinStack(...args: Parameters<typeof joinStackUnsafe>) {
  const joined = joinStackUnsafe(...args)
  leaves.push(joined.leave)
  return joined
}

function entry(name: string, end = 300) {
  return {
    name,
    scroller: document.createElement('div'),
    range: { start: 0, end },
  }
}

const anim = (el: HTMLElement, prop: string) =>
  el.style.getPropertyValue(`animation-${prop}`)

describe('drawer stack', () => {
  afterEach(() => {
    for (const leave of leaves.splice(0).reverse()) leave()
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('recedes each drawer once per drawer in front, driven by their swipes', () => {
    vi.stubGlobal('CSS', { supports: () => true })
    const a = entry('--a')
    const b = entry('--b')
    const c = entry('--c')
    const ja = joinStack(a)
    expect(anim(a.scroller, 'name')).toBe('')
    const jb = joinStack(b)
    const jc = joinStack(c)

    expect(
      document.documentElement.style.getPropertyValue('timeline-scope'),
    ).toBe('--a, --b, --c')
    expect(anim(a.scroller, 'timeline')).toBe('--b, --c')
    expect(anim(a.scroller, 'composition')).toBe('accumulate, accumulate')
    expect(anim(a.scroller, 'range')).toBe('0px 300px, 0px 300px')
    expect(anim(b.scroller, 'timeline')).toBe('--c')
    expect(anim(c.scroller, 'name')).toBe('')

    jc.leave()
    expect(anim(a.scroller, 'timeline')).toBe('--b')
    expect(anim(b.scroller, 'name')).toBe('')
    jb.leave()
    ja.leave()
    expect(anim(a.scroller, 'name')).toBe('')
    expect(
      document.documentElement.style.getPropertyValue('timeline-scope'),
    ).toBe('')
  })

  it('recedes on a timer behind a pinned drawer or without scroll timelines', () => {
    vi.stubGlobal('CSS', { supports: () => true })
    const a = entry('--a')
    const ja = joinStack(a)
    const jp = joinStack(entry('--pinned', 0))
    expect(anim(a.scroller, 'timeline')).toBe('auto')
    expect(anim(a.scroller, 'duration')).toBe('300ms')
    jp.leave()

    vi.stubGlobal('CSS', { supports: () => false })
    const jb = joinStack(entry('--b'))
    expect(anim(a.scroller, 'timeline')).toBe('auto')
    jb.leave()
    ja.leave()
  })

  it('reports each drawer its depth so drawers above the first can dim less', () => {
    vi.stubGlobal('CSS', { supports: () => true })
    const depths: Record<string, number> = {}
    const a = { ...entry('--a'), onDepth: (d: number) => (depths.a = d) }
    const b = { ...entry('--b'), onDepth: (d: number) => (depths.b = d) }
    const ja = joinStack(a)
    const jb = joinStack(b)
    expect(depths).toEqual({ a: 0, b: 1 })
    ja.leave()
    expect(depths.b).toBe(0)
    jb.leave()
  })

  it('eases the drawers behind back when a drawer leaves', () => {
    vi.stubGlobal('CSS', { supports: () => true })
    const a = entry('--a')
    const animate = vi.fn()
    a.scroller.animate = animate
    document.body.append(a.scroller)
    const ja = joinStack(a)
    const jp = joinStack(entry('--pinned', 0))
    a.scroller.style.transform = 'matrix(0.92, 0, 0, 0.92, 0, -8)'
    jp.leave()
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'matrix(0.92, 0, 0, 0.92, 0, -8)', offset: 0 }],
      expect.objectContaining({ duration: 300 }),
    )
    ja.leave()
  })

  it("keeps the page's own timeline scope while drawers are open", () => {
    vi.stubGlobal('CSS', { supports: () => true })
    const root = document.documentElement.style
    root.setProperty('timeline-scope', '--page')
    try {
      const ja = joinStack(entry('--a'))
      expect(root.getPropertyValue('timeline-scope')).toBe('--page, --a')
      ja.leave()
      expect(root.getPropertyValue('timeline-scope')).toBe('--page')
    } finally {
      root.removeProperty('timeline-scope')
    }
  })

  it('follows a front drawer whose stops change', () => {
    vi.stubGlobal('CSS', { supports: () => true })
    const a = entry('--a')
    const ja = joinStack(a)
    const jb = joinStack(entry('--b', 0))
    expect(anim(a.scroller, 'timeline')).toBe('auto')
    jb.update({ start: 0, end: 420 })
    expect(anim(a.scroller, 'timeline')).toBe('--b')
    expect(anim(a.scroller, 'range')).toBe('0px 420px')
    jb.leave()
    ja.leave()
  })
})
