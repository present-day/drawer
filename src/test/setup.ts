import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll } from 'vitest'

import { forceUnlock, initTailwindMerge } from '../utils'
import { resetVisualViewportForTests, testVisualViewport } from './vv-mock'

beforeAll(async () => {
  await initTailwindMerge()
})

Object.defineProperty(window, 'visualViewport', {
  configurable: true,
  value: testVisualViewport,
})
Object.defineProperty(window, 'innerHeight', {
  configurable: true,
  value: 900,
})

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}

if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = function setPointerCapture() {}
}
if (typeof Element.prototype.releasePointerCapture !== 'function') {
  Element.prototype.releasePointerCapture = function releasePointerCapture() {}
}

if (typeof globalThis.Touch === 'undefined') {
  globalThis.Touch = class PolyTouch {
    clientX: number
    clientY: number
    identifier: number
    target: EventTarget
    constructor(init: {
      clientX: number
      clientY: number
      identifier: number
      target: EventTarget
    }) {
      this.clientX = init.clientX
      this.clientY = init.clientY
      this.identifier = init.identifier
      this.target = init.target
    }
  } as unknown as typeof Touch
}

// Web Animations marks a canceled animation's `finished` rejection as handled,
// so browsers never report it. happy-dom (>= 20.13) rejects without doing so,
// and Motion cancels animations it never awaits: every drawer close turned
// into an unhandled AbortError and failed the run with all tests green. Mark
// it handled before canceling — the same promise still rejects for anyone
// awaiting it, exactly as in a browser.
if (typeof globalThis.Animation === 'function') {
  const cancel = Animation.prototype.cancel
  Animation.prototype.cancel = function cancelLikeABrowser(this: Animation) {
    this.finished?.catch(() => {})
    return cancel.call(this)
  }
}

afterEach(() => {
  cleanup()
  forceUnlock()
  resetVisualViewportForTests()
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')
})
