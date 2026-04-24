const listeners = new Map<string, Set<EventListener>>()

/**
 * JSDOM-friendly `VisualViewport` used by `useVisualViewport` tests.
 * Mutate `height` / `offsetTop`, then call `emitVisualViewportEvent`.
 */
export const testVisualViewport = {
  /** Default matches `window.innerHeight` in `test/setup` so `layoutBottomInset` is 0. */
  height: 900,
  offsetTop: 0,
  addEventListener(type: string, callback: EventListener) {
    if (!listeners.has(type)) {
      listeners.set(type, new Set())
    }
    listeners.get(type)?.add(callback)
  },
  removeEventListener(type: string, callback: EventListener) {
    listeners.get(type)?.delete(callback)
  },
}

export function emitVisualViewportEvent(type: 'resize' | 'scroll') {
  for (const fn of listeners.get(type) ?? []) {
    ;(fn as (ev: Event) => void).call(
      testVisualViewport as unknown as EventTarget,
      new Event(type),
    )
  }
}

export function setVisualViewportSize(height: number, offsetTop = 0) {
  testVisualViewport.height = height
  testVisualViewport.offsetTop = offsetTop
  emitVisualViewportEvent('resize')
}

export function resetVisualViewportForTests() {
  testVisualViewport.height = 900
  testVisualViewport.offsetTop = 0
  listeners.clear()
}
