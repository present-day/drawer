import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

import { forceUnlock } from '../utils'
import { resetVisualViewportForTests, testVisualViewport } from './vv-mock'

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

afterEach(() => {
  cleanup()
  forceUnlock()
  resetVisualViewportForTests()
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')
})
