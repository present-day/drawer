'use client'

import type React from 'react'
import { forwardRef } from 'react'
import { useDrawerSlots } from '../../drawerSlotsContext'
import { cn } from '../../utils'
import styles from './DrawerHandle.module.pcss'

/**
 * Drag handle chrome (optional). The track has `data-drawer-handle`. The default
 * bar has `data-drawer-handle-indicator`. Pass `children` to replace the default
 * bar; use `indicatorClassName` to style only the default bar without child
 * selectors like `[&>span]:…`.
 */
export type DrawerHandleProps = React.HTMLAttributes<HTMLDivElement> & {
  indicatorClassName?: string
}

export const DrawerHandle = forwardRef<HTMLDivElement, DrawerHandleProps>(
  function DrawerHandle(
    { className, indicatorClassName, children, ...rest },
    ref,
  ) {
    const slots = useDrawerSlots()

    return (
      <div
        ref={ref}
        data-drawer-handle
        className={cn(
          'relative mx-auto flex pt-3 pb-2 w-full shrink-0 cursor-grab touch-manipulation items-center justify-center active:cursor-grabbing',
          slots.handleClassName,
          className,
        )}
        aria-hidden
        {...rest}
      >
        {children ?? (
          <span
            data-drawer-handle-indicator
            className={cn(
              styles.indicator,
              slots.handleIndicatorClassName,
              indicatorClassName,
            )}
          />
        )}
      </div>
    )
  },
)
