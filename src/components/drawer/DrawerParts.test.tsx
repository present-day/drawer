import { render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Drawer } from '../Drawer'

const slots = {
  contentClassName: 'slot-content',
  handleClassName: 'slot-handle',
  handleIndicatorClassName: 'slot-indicator',
}

describe('Drawer parts & slots', () => {
  it('applies slot class names in merge order: defaults → slots → part props', async () => {
    render(
      <Drawer
        open
        onOpenChange={vi.fn()}
        snapPoints={['full']}
        slots={slots}
      >
        <Drawer.Content className="content-extra">
          <Drawer.Handle
            className="handle-extra"
            indicatorClassName="ind-extra"
          />
        </Drawer.Content>
      </Drawer>,
    )
    const content = (await waitFor(() =>
      document.querySelector('[data-drawer-content]'),
    )) as HTMLDivElement
    expect(content.className).toMatch(/slot-content/)
    expect(content.className).toMatch(/content-extra/)

    const handle = document.querySelector(
      '[data-drawer-handle]',
    ) as HTMLDivElement
    expect(handle.className).toMatch(/slot-handle/)
    expect(handle.className).toMatch(/handle-extra/)

    const ind = document.querySelector(
      '[data-drawer-handle-indicator]',
    ) as HTMLSpanElement
    expect(ind.className).toMatch(/slot-indicator/)
    expect(ind.className).toMatch(/ind-extra/)
  })

  it('renders custom handle children instead of the default bar', () => {
    render(
      <Drawer open onOpenChange={vi.fn()} snapPoints={['full']}>
        <Drawer.Content>
          <Drawer.Handle>
            <span data-testid="custom">grab</span>
          </Drawer.Handle>
        </Drawer.Content>
      </Drawer>,
    )
    expect(screen.getByTestId('custom')).toHaveTextContent('grab')
    expect(
      document.querySelector('[data-drawer-handle-indicator]'),
    ).not.toBeInTheDocument()
  })

  it('assigns object refs on Content and Scrollable (forwardRef object branch)', async () => {
    const contentRef = createRef<HTMLDivElement>()
    const scrollRef = createRef<HTMLDivElement>()
    render(
      <Drawer open onOpenChange={vi.fn()} snapPoints={['full']}>
        <Drawer.Content ref={contentRef} data-testid="c">
          <Drawer.Scrollable ref={scrollRef}>a</Drawer.Scrollable>
        </Drawer.Content>
      </Drawer>,
    )
    await waitFor(() => {
      expect(contentRef.current).toBeInstanceOf(HTMLDivElement)
      expect(scrollRef.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  it('merges className on scrollable, syncs externalRef, and supports callback ref on scrollable and content', async () => {
    const ext = createRef<HTMLElement | null>()
    const scrollCb = vi.fn()
    const contentCb = vi.fn()
    const handleCb = vi.fn()
    function ScrollWrapper() {
      return (
        <Drawer open onOpenChange={vi.fn()} snapPoints={['full']}>
          <Drawer.Content
            className="c2"
            ref={(el) => {
              contentCb(!!el)
            }}
          >
            <Drawer.Scrollable
              className="scroll-extra"
              externalRef={ext}
              ref={scrollCb}
            >
              inner
            </Drawer.Scrollable>
            <Drawer.Handle ref={handleCb} />
          </Drawer.Content>
        </Drawer>
      )
    }
    render(<ScrollWrapper />)
    const scroll = (await waitFor(() =>
      document.querySelector('[data-drawer-scroll]'),
    )) as HTMLDivElement
    expect(scroll.className).toMatch(/scroll-extra/)
    expect(ext.current).toBe(scroll)
    expect(contentCb).toHaveBeenCalledWith(true)
    expect(scrollCb).toHaveBeenCalled()
    expect(handleCb).toHaveBeenCalled()
  })

  it('renders null for the Overlay compound export', () => {
    const { container } = render(<Drawer.Overlay />)
    expect(container).toBeEmptyDOMElement()
  })
})
