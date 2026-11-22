import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ReactNode, useState } from 'react'
import { ScrollDrawer, type ScrollDrawerProps } from '../src'

type Variant = 'basic' | 'long' | 'input'
type LogLine = { id: number; text: string }

const ROWS = Array.from({ length: 60 }, (_, i) => `Row ${i + 1}`)
let logId = 0

function Body({ variant }: { variant: Variant }) {
  if (variant === 'long') {
    return (
      <ul className="divide-y divide-black/10 px-4 pb-6">
        {ROWS.map((row) => (
          <li key={row} className="py-3">
            {row}
          </li>
        ))}
      </ul>
    )
  }
  if (variant === 'input') {
    return (
      <form className="flex flex-col gap-3 px-4 pb-6">
        <label className="flex flex-col gap-1 text-sm">
          Message
          <input
            className="rounded-lg border border-black/20 px-3 py-2 text-base"
            placeholder="Tap to open the keyboard"
          />
        </label>
        <p className="text-sm opacity-70">
          The content pads itself by the keyboard height via
          --visual-viewport-height.
        </p>
      </form>
    )
  }
  return (
    <div className="px-4 pb-8">
      <h2 className="mb-2 text-lg font-semibold">Scroll-snap drawer</h2>
      <p className="text-sm opacity-80">
        Swipe down to dismiss. The drag is native scrolling, so it runs on the
        compositor at the display refresh rate.
      </p>
    </div>
  )
}

function Demo({
  variant,
  closeButton,
  ...props
}: Omit<ScrollDrawerProps, 'open' | 'onOpenChange'> & {
  variant: Variant
  closeButton?: boolean
}) {
  const [open, setOpen] = useState(true)
  const [log, setLog] = useState<LogLine[]>([])
  const push = (text: string) =>
    setLog((prev) => [{ id: ++logId, text }, ...prev].slice(0, 8))
  return (
    <Page onOpen={() => setOpen(true)} log={log}>
      <ScrollDrawer
        {...props}
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          push(`onOpenChange(${next})`)
        }}
        onSnapChange={(i) => push(`onSnapChange(${i})`)}
        aria-label="Scroll drawer"
        className="bg-surface text-fg"
      >
        <ScrollDrawer.Handle />
        <ScrollDrawer.Content>
          {closeButton ? (
            <button
              type="button"
              className="mx-4 mb-3 rounded-lg border border-black/20 px-3 py-1 text-sm"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          ) : null}
          <Body variant={variant} />
        </ScrollDrawer.Content>
      </ScrollDrawer>
    </Page>
  )
}

function Page({
  onOpen,
  log,
  children,
}: {
  onOpen: () => void
  log: LogLine[]
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh p-4">
      <button
        type="button"
        className="rounded-lg border border-black/20 px-3 py-2"
        onClick={onOpen}
      >
        Open
      </button>
      <ol className="mt-4 font-mono text-xs opacity-70">
        {log.map((line) => (
          <li key={line.id}>{line.text}</li>
        ))}
      </ol>
      {children}
    </div>
  )
}

const meta = {
  title: 'Experimental/ScrollDrawer',
  component: Demo,
  parameters: { layout: 'fullscreen' },
  args: { variant: 'basic' },
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {}

export const SnapPoints: Story = {
  args: { variant: 'long', snapPoints: [200, 420] },
}

export const NonDismissible: Story = {
  args: {
    variant: 'long',
    snapPoints: [200, 420],
    dismissible: false,
    closeButton: true,
  },
}

export const LongContent: Story = {
  args: { variant: 'long' },
}

export const InputField: Story = {
  args: { variant: 'input' },
}
