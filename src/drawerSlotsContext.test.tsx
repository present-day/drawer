import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DrawerSlotsProvider, useDrawerSlots } from './drawerSlotsContext'

function SlotReader() {
  const slots = useDrawerSlots()
  return <div data-testid="slots">{JSON.stringify(slots)}</div>
}

describe('useDrawerSlots', () => {
  it('returns empty object when no provider is present', () => {
    render(<SlotReader />)
    expect(screen.getByTestId('slots')).toHaveTextContent('{}')
  })

  it('forwards class names from DrawerSlotsProvider', () => {
    render(
      <DrawerSlotsProvider
        value={{
          contentClassName: 'c',
          handleClassName: 'h',
          handleIndicatorClassName: 'i',
        }}
      >
        <SlotReader />
      </DrawerSlotsProvider>,
    )
    const text = screen.getByTestId('slots').textContent
    expect(text).toContain('c')
    expect(text).toContain('h')
    expect(text).toContain('i')
  })
})
