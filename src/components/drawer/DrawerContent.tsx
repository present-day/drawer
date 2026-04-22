'use client'

import type React from 'react'
import { forwardRef, useCallback } from 'react'
import { DRAWER_CONTEXT_CONSUMER } from '../../constants'
import { useDrawerContext } from '../../context'
import { useDrawerSlots } from '../../drawerSlotsContext'
import { cn } from '../../utils'

/**
 * Main panel surface inside the drawer. `className` and `style` are merged after
 * internal defaults via `cn` / spread order.
 *
 * **Theming:** root has `data-drawer-content`. Scroll areas use `data-drawer-scroll`
 * on `Drawer.Scrollable`. Opt out of drag on controls with `data-drawer-no-drag`.
 */
export type DrawerContentProps = React.HTMLAttributes<HTMLDivElement>

export const DrawerContent = forwardRef<HTMLDivElement, DrawerContentProps>(
  function DrawerContent({ className, children, ...rest }, forwardedRef) {
    const { measureRef } = useDrawerContext(DRAWER_CONTEXT_CONSUMER.Content)
    const slots = useDrawerSlots()

    const setRefs = useCallback(
      (el: HTMLDivElement | null) => {
        measureRef.current = el
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef) forwardedRef.current = el
      },
      [forwardedRef, measureRef],
    )

    return (
      <div
        ref={setRefs}
        data-drawer-content
        className={cn(
          'flex min-h-0 flex-1 touch-manipulation flex-col overscroll-y-none rounded-t-3xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)]',
          slots.contentClassName,
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    )
  },
)
