'use client'

import type React from 'react'
import { forwardRef, useCallback } from 'react'
import { DRAWER_CONTEXT_CONSUMER } from '../constants'
import { useDrawerContext } from '../context'
import { useDrawerSlots } from '../drawerSlotsContext'
import { useDrawerDrag } from '../hooks/useDrawerDrag'
import { cn } from '../utils'

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

export type DrawerScrollableProps = React.HTMLAttributes<HTMLDivElement> & {
  externalRef?: React.RefObject<HTMLElement | null>
}

export const DrawerScrollable = forwardRef<
  HTMLDivElement,
  DrawerScrollableProps
>(function DrawerScrollable(
  { className, children, externalRef, ...rest },
  forwardedRef,
) {
  const {
    scrollContainerRef,
    registerScrollContainer,
    scrollAttachGeneration,
  } = useDrawerContext(DRAWER_CONTEXT_CONSUMER.Scrollable)

  const { scrollContainerProps } = useDrawerDrag({
    scrollContainerRef,
    enabled: true,
    scrollAttachGeneration,
  })

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      registerScrollContainer(el)
      if (externalRef && 'current' in externalRef) {
        ;(externalRef as React.MutableRefObject<HTMLElement | null>).current =
          el
      }
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) forwardedRef.current = el
    },
    [externalRef, forwardedRef, registerScrollContainer],
  )

  return (
    <div
      ref={setRefs}
      data-drawer-scroll
      className={cn(
        'min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-none',
        className,
      )}
      {...scrollContainerProps}
      {...rest}
    >
      {children}
    </div>
  )
})

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
              'block h-1 w-[100px] rounded-full bg-gray-400/25',
              slots.handleIndicatorClassName,
              indicatorClassName,
            )}
          />
        )}
      </div>
    )
  },
)

export function DrawerOverlay() {
  return null
}
