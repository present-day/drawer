import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Web Animations: canceling rejects the animation's `finished` promise with
// an AbortError AND marks that promise handled, so browsers never report it.
// happy-dom 20.13 rejects without marking it handled, and Motion cancels
// animations it never awaits — every drawer close became an unhandled
// rejection and Vitest failed the run with all tests passing. The setup file
// restores the browser behavior; these tests pin both halves of it.

let unhandled: unknown[]
const onUnhandled = (reason: unknown) => {
  unhandled.push(reason)
}

beforeEach(() => {
  unhandled = []
  process.on('unhandledRejection', onUnhandled)
})

afterEach(() => {
  process.off('unhandledRejection', onUnhandled)
})

function startAnimation() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000 })
}

describe('Animation.cancel under happy-dom', () => {
  it('does not surface an unhandled rejection when nobody awaits finished', async () => {
    const animation = startAnimation()
    animation.cancel()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(unhandled).toEqual([])
  })

  it('still rejects finished with an AbortError for anyone awaiting it', async () => {
    const animation = startAnimation()
    const finished = animation.finished
    animation.cancel()
    await expect(finished).rejects.toMatchObject({ name: 'AbortError' })
  })
})
