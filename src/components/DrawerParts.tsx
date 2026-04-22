'use client'

import React, { forwardRef, useCallback } from 'react'

import { useDrawerContext } from '../context'
import { DRAWER_CONTEXT_CONSUMER } from '../constants'
import { useDrawerDrag } from '../hooks/useDrawerDrag'
import { cn } from '../utils'

export type DrawerContentProps = React.HTMLAttributes<HTMLDivElement>

export const DrawerContent = forwardRef<
  HTMLDivElement,
  DrawerContentProps
>(function DrawerContent({ className, children, ...rest }, forwardedRef) {
  const { measureRef } = useDrawerContext(
    DRAWER_CONTEXT_CONSUMER.Content,
  )

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
      className={cn(
        'flex min-h-0 flex-1 touch-manipulation flex-col overscroll-y-none rounded-t-3xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
})

export type DrawerScrollableProps =
  React.HTMLAttributes<HTMLDivElement> & {
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
      data-bottom-sheet-scroll
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

export function DrawerHandle({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative mx-auto flex pt-3 pb-2 w-full shrink-0 cursor-grab touch-manipulation items-center justify-center active:cursor-grabbing',
        className,
      )}
      aria-hidden
      {...rest}
    >
      <span className="block h-1 w-[100px] rounded-full bg-gray-400/25" />
    </div>
  )
}

export function DrawerOverlay() {
  return null
}

// Backward compatibility
export type BottomSheetContentProps = DrawerContentProps
export type BottomSheetScrollableProps = DrawerScrollableProps
export const BottomSheetContent = DrawerContent
export const BottomSheetScrollable = DrawerScrollable
export const BottomSheetHandle = DrawerHandle
export const BottomSheetOverlay = DrawerOverlay