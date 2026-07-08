import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { setVisualViewportSize } from '../test/vv-mock'
import type { DrawerRef } from '../types'
import { Drawer } from './Drawer'

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    const onOpenChange = vi.fn()
    render(
      <Drawer open={false} onOpenChange={onOpenChange} snapPoints={['full']}>
        <Drawer.Content>Panel</Drawer.Content>
      </Drawer>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mounts the dialog in a portal with compound children', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <Drawer open onOpenChange={onOpenChange} snapPoints={['full']}>
        <Drawer.Content>
          <Drawer.Handle />
          <span>Hello drawer</span>
        </Drawer.Content>
      </Drawer>,
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Hello drawer')).toBeInTheDocument()
    expect(document.querySelector('[data-drawer-content]')).toBeTruthy()
    expect(document.querySelector('[data-drawer-handle]')).toBeTruthy()

    const [overlay] = screen.getAllByRole('button', { hidden: true })
    if (!overlay) {
      expect.fail('expected modal overlay button')
    }
    await user.click(overlay)

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('exposes imperative dismiss via ref', async () => {
    const onOpenChange = vi.fn()
    const ref = createRef<DrawerRef>()

    render(
      <Drawer ref={ref} open onOpenChange={onOpenChange} snapPoints={[0.5]}>
        <Drawer.Content>Ref test</Drawer.Content>
      </Drawer>,
    )

    await screen.findByRole('dialog')
    await waitFor(() => {
      expect(ref.current).not.toBeNull()
    })

    ref.current?.dismiss()

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('links aria-labelledby / aria-describedby to visually hidden title and description', async () => {
    render(
      <Drawer
        open
        onOpenChange={vi.fn()}
        snapPoints={['full']}
        title="Sheet title"
        description="Extra context for assistive tech"
      >
        <Drawer.Content>Body</Drawer.Content>
      </Drawer>,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Sheet title' })
    const titleEl = document.getElementById(
      dialog.getAttribute('aria-labelledby') ?? '',
    )
    const descEl = document.getElementById(
      dialog.getAttribute('aria-describedby') ?? '',
    )
    expect(titleEl).toHaveTextContent('Sheet title')
    expect(titleEl).toHaveClass('sr-only')
    expect(descEl).toHaveTextContent('Extra context for assistive tech')
    expect(descEl).toHaveClass('sr-only')
  })

  it('uses aria-label when no title is passed', async () => {
    render(
      <Drawer
        open
        onOpenChange={vi.fn()}
        snapPoints={['full']}
        ariaLabel="Filters"
      >
        <Drawer.Content>Body</Drawer.Content>
      </Drawer>,
    )
    expect(
      await screen.findByRole('dialog', { name: 'Filters' }),
    ).toBeInTheDocument()
  })

  it('closes on Escape when dismissible', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Drawer open onOpenChange={onOpenChange} snapPoints={['full']}>
        <Drawer.Content>Body</Drawer.Content>
      </Drawer>,
    )
    const dialog = await screen.findByRole('dialog')
    dialog.focus()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Escape inside editable fields', () => {
    it('does not dismiss on Escape while a text field has content (Escape clears first)', async () => {
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      render(
        <Drawer open onOpenChange={onOpenChange} snapPoints={['full']}>
          <Drawer.Content>
            <input type="search" aria-label="Query" defaultValue="coffee" />
          </Drawer.Content>
        </Drawer>,
      )
      const input = await screen.findByLabelText('Query')
      input.focus()
      await user.keyboard('{Escape}')
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })

    it('dismisses on Escape when the focused text field is empty', async () => {
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      render(
        <Drawer open onOpenChange={onOpenChange} snapPoints={['full']}>
          <Drawer.Content>
            <input type="search" aria-label="Query" defaultValue="" />
          </Drawer.Content>
        </Drawer>,
      )
      const input = await screen.findByLabelText('Query')
      input.focus()
      await user.keyboard('{Escape}')
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('does not dismiss on Escape when the event default was prevented', async () => {
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      render(
        <Drawer open onOpenChange={onOpenChange} snapPoints={['full']}>
          <Drawer.Content>
            <button
              type="button"
              onKeyDown={(e) => {
                if (e.key === 'Escape') e.preventDefault()
              }}
            >
              Keep open
            </button>
          </Drawer.Content>
        </Drawer>,
      )
      const btn = await screen.findByRole('button', { name: 'Keep open' })
      btn.focus()
      await user.keyboard('{Escape}')
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })

    it('dismisses on Escape from non-text inputs like checkboxes', async () => {
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      render(
        <Drawer open onOpenChange={onOpenChange} snapPoints={['full']}>
          <Drawer.Content>
            <input type="checkbox" aria-label="Agree" />
          </Drawer.Content>
        </Drawer>,
      )
      const box = await screen.findByLabelText('Agree')
      box.focus()
      await user.keyboard('{Escape}')
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('does not dismiss on Escape while a contenteditable element has content', async () => {
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      render(
        <Drawer open onOpenChange={onOpenChange} snapPoints={['full']}>
          <Drawer.Content>
            {/* biome-ignore lint/a11y/useFocusableInteractive: contenteditable is natively focusable */}
            {/* biome-ignore lint/a11y/useSemanticElements: exercising the contenteditable Escape path requires a real contenteditable */}
            <div role="textbox" contentEditable suppressContentEditableWarning>
              draft text
            </div>
          </Drawer.Content>
        </Drawer>,
      )
      const box = await screen.findByRole('textbox')
      box.focus()
      await user.keyboard('{Escape}')
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })
  })

  describe('keyboard geometry', () => {
    it('clamps panel max-height to the live visual viewport minus top inset', async () => {
      render(
        <Drawer open onOpenChange={vi.fn()} snapPoints={['full']}>
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      const dialog = await screen.findByRole('dialog')

      // Initial viewport (900px) minus the default 96px top inset.
      await waitFor(() => {
        expect(dialog.style.maxHeight).toBe('804px')
      })

      // Soft keyboard opens: visual viewport shrinks to 500px. The clamp must
      // follow immediately (no spring) so content can't overshoot the top.
      act(() => {
        setVisualViewportSize(500, 0)
      })
      await waitFor(() => {
        expect(dialog.style.maxHeight).toBe('404px')
      })
    })

    it('animates the keyboard lift (bottom inset) instead of jumping instantly', async () => {
      render(
        <Drawer open onOpenChange={vi.fn()} snapPoints={['full']}>
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      const dialog = await screen.findByRole('dialog')
      await waitFor(() => {
        expect(dialog.style.maxHeight).toBe('804px')
      })

      // Keyboard opens: layout bottom inset becomes 900 - 700 - 10 = 190.
      act(() => {
        setVisualViewportSize(700, 10)
      })

      // The render that observes the new viewport must NOT have already
      // teleported the panel bottom to 190px — the lift is animated.
      await waitFor(() => {
        expect(dialog.style.maxHeight).toBe('604px')
      })
      expect(Number.parseFloat(dialog.style.bottom || '0')).toBeLessThan(190)

      // ...but it settles at the inset.
      await waitFor(
        () => {
          expect(
            Number.parseFloat(dialog.style.bottom || '0'),
          ).toBeGreaterThanOrEqual(189)
        },
        { timeout: 3000 },
      )
    })

    it('still resnaps to keyboard-shrunk viewport while a finger rests without dragging', async () => {
      render(
        <Drawer open onOpenChange={vi.fn()} snapPoints={['full']}>
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      const dialog = await screen.findByRole('dialog')
      // Wait for the intro animation to land on the initial 'full' height.
      await waitFor(
        () => {
          expect(Number.parseFloat(dialog.style.height || '0')).toBeCloseTo(
            804,
            0,
          )
        },
        { timeout: 3000 },
      )

      // Finger down on the panel (a tap that never moves): creates an
      // inactive drag session that must not freeze keyboard adaptation.
      fireEvent.pointerDown(screen.getByText('Body'), {
        pointerId: 7,
        button: 0,
        clientY: 400,
      })

      act(() => {
        setVisualViewportSize(500, 0)
      })

      await waitFor(
        () => {
          expect(Number.parseFloat(dialog.style.height || '0')).toBeCloseTo(
            404,
            0,
          )
        },
        { timeout: 3000 },
      )
    })

    it('does not shrink AUTO under the user while the keyboard is open and focus is inside', async () => {
      let contentHeight = 600
      const measuredRef = (el: HTMLDivElement | null) => {
        if (el) {
          Object.defineProperty(el, 'offsetHeight', {
            configurable: true,
            get: () => contentHeight,
          })
        }
      }
      render(
        <Drawer open onOpenChange={vi.fn()} snapPoints={['auto']}>
          <Drawer.Content>
            <div ref={measuredRef} data-testid="measured">
              <input type="search" aria-label="Query" defaultValue="coffee" />
            </div>
          </Drawer.Content>
        </Drawer>,
      )
      const dialog = await screen.findByRole('dialog')
      await waitFor(
        () => {
          expect(Number.parseFloat(dialog.style.height || '0')).toBeCloseTo(
            600,
            0,
          )
        },
        { timeout: 3000 },
      )

      const input = screen.getByLabelText('Query')
      input.focus()

      // Keyboard opens: viewport 500, clamp = 404, AUTO capped → resnap to 404.
      act(() => {
        setVisualViewportSize(500, 0)
      })
      await waitFor(
        () => {
          expect(Number.parseFloat(dialog.style.height || '0')).toBeCloseTo(
            404,
            0,
          )
        },
        { timeout: 3000 },
      )

      // Query cleared → results collapse. Trigger a re-measure via the
      // capture-phase load listener (happy-dom drops MutationObservers that
      // were registered during the drawer's mount commit, so the MO path
      // can't be driven here; the downstream measure → resnap pipeline is
      // identical for both triggers).
      contentHeight = 120
      act(() => {
        screen.getByTestId('measured').dispatchEvent(new Event('load'))
      })

      // While the keyboard is up and focus stays in the field, the drawer
      // must hold its height — shrinking would drop the tap target and let
      // the next tap fall through onto the dismiss overlay.
      await new Promise((r) => setTimeout(r, 800))
      expect(Number.parseFloat(dialog.style.height || '0')).toBeGreaterThan(390)

      // Keyboard closes → the floor releases and AUTO tracks content again.
      act(() => {
        setVisualViewportSize(900, 0)
      })
      await waitFor(
        () => {
          expect(Number.parseFloat(dialog.style.height || '0')).toBeCloseTo(
            120,
            0,
          )
        },
        { timeout: 3000 },
      )
    })
  })

  describe('safe-area insets', () => {
    it('exposes env(safe-area-inset-bottom) on the panel by default', async () => {
      render(
        <Drawer open onOpenChange={vi.fn()} snapPoints={['full']}>
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      const dialog = await screen.findByRole('dialog')
      // happy-dom drops env() from standard properties (padding-bottom reads
      // as ''), so assert via the custom property, which passes through
      // unvalidated and carries the same value. The numeric test below covers
      // the actual padding + AUTO growth pipeline.
      expect(dialog.style.getPropertyValue('--drawer-safe-area-bottom')).toBe(
        'env(safe-area-inset-bottom, 0px)',
      )
    })

    it('omits the safe-area padding when safeAreaBottom is false', async () => {
      render(
        <Drawer
          open
          onOpenChange={vi.fn()}
          snapPoints={['full']}
          safeAreaBottom={false}
        >
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      const dialog = await screen.findByRole('dialog')
      expect(dialog.style.paddingBottom).toBe('')
      expect(dialog.style.getPropertyValue('--drawer-safe-area-bottom')).toBe(
        '0px',
      )
    })

    it('grows AUTO by a numeric safeAreaBottom so content clears the home indicator', async () => {
      const contentHeight = 600
      const measuredRef = (el: HTMLDivElement | null) => {
        if (el) {
          Object.defineProperty(el, 'offsetHeight', {
            configurable: true,
            get: () => contentHeight,
          })
        }
      }
      render(
        <Drawer
          open
          onOpenChange={vi.fn()}
          snapPoints={['auto']}
          safeAreaBottom={34}
        >
          <Drawer.Content>
            <div ref={measuredRef}>Body</div>
          </Drawer.Content>
        </Drawer>,
      )
      const dialog = await screen.findByRole('dialog')
      expect(dialog.style.paddingBottom).toBe('34px')
      await waitFor(
        () => {
          expect(Number.parseFloat(dialog.style.height || '0')).toBeCloseTo(
            634,
            0,
          )
        },
        { timeout: 3000 },
      )
    })
  })

  describe('onClose transition semantics', () => {
    it('does not call onClose when initially mounted with open=false', () => {
      const onClose = vi.fn()
      render(
        <Drawer
          open={false}
          onOpenChange={vi.fn()}
          onClose={onClose}
          snapPoints={['full']}
        >
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      expect(onClose).not.toHaveBeenCalled()
    })

    it('calls onClose exactly once when controlled open transitions true → false', async () => {
      const onClose = vi.fn()
      const { rerender } = render(
        <Drawer
          open={true}
          onOpenChange={vi.fn()}
          onClose={onClose}
          snapPoints={['full']}
        >
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      await screen.findByRole('dialog')
      expect(onClose).not.toHaveBeenCalled()

      rerender(
        <Drawer
          open={false}
          onOpenChange={vi.fn()}
          onClose={onClose}
          snapPoints={['full']}
        >
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1)
      })
    })

    it('does not call onClose on subsequent renders when already closed', async () => {
      const onClose = vi.fn()
      const { rerender } = render(
        <Drawer
          open={true}
          onOpenChange={vi.fn()}
          onClose={onClose}
          snapPoints={['full']}
        >
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      await screen.findByRole('dialog')

      rerender(
        <Drawer
          open={false}
          onOpenChange={vi.fn()}
          onClose={onClose}
          snapPoints={['full']}
        >
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1)
      })

      // Re-render again while still closed — onClose must not fire again
      rerender(
        <Drawer
          open={false}
          onOpenChange={vi.fn()}
          onClose={onClose}
          snapPoints={['full']}
        >
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose exactly once in the uncontrolled flow when closed via overlay click', async () => {
      const onClose = vi.fn()
      const onOpenChange = vi.fn()
      const user = userEvent.setup()

      render(
        <Drawer
          defaultOpen
          onOpenChange={onOpenChange}
          onClose={onClose}
          snapPoints={['full']}
        >
          <Drawer.Content>Body</Drawer.Content>
        </Drawer>,
      )
      await screen.findByRole('dialog')
      expect(onClose).not.toHaveBeenCalled()

      const [overlay] = screen.getAllByRole('button', { hidden: true })
      if (!overlay) expect.fail('expected modal overlay button')
      await user.click(overlay)

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1)
      })
      // Ensure no extra calls after the transition settles
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})
