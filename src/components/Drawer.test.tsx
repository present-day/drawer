import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

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
})
