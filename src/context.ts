'use client'

import { createContext, useContext } from 'react'

import type { DRAWER_CONTEXT_CONSUMER } from './constants'

export type DrawerContextConsumer =
  (typeof DRAWER_CONTEXT_CONSUMER)[keyof typeof DRAWER_CONTEXT_CONSUMER]

export type DrawerContextValue = {
  measureRef: React.RefObject<HTMLDivElement | null>
  scrollContainerRef: React.RefObject<HTMLElement | null>
  registerScrollContainer: (el: HTMLElement | null) => void
  scrollAttachGeneration: number
}

export const DrawerContext = createContext<DrawerContextValue | null>(null)

export function useDrawerContext(consumer: DrawerContextConsumer) {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error(`${consumer} must be used within Drawer`)
  return ctx
}
