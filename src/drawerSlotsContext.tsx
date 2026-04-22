'use client'

import type React from 'react'
import { createContext, useContext } from 'react'

import type { DrawerSlots } from './types'

const DrawerSlotsContext = createContext<DrawerSlots | null>(null)

export function DrawerSlotsProvider({
  value,
  children,
}: {
  value: DrawerSlots
  children: React.ReactNode
}) {
  return (
    <DrawerSlotsContext.Provider value={value}>
      {children}
    </DrawerSlotsContext.Provider>
  )
}

/** Returns slot class names from the nearest `Drawer` (empty object if none). */
export function useDrawerSlots(): DrawerSlots {
  return useContext(DrawerSlotsContext) ?? {}
}
