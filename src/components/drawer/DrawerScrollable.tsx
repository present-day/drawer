'use client'

import type React from 'react'
import { forwardRef, useCallback } from 'react'
import { DRAWER_CONTEXT_CONSUMER } from '../../constants'
import { useDrawerContext } from '../../context'
import { useDrawerDrag } from '../../hooks/useDrawerDrag'
import { cn } from '../../utils'

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
