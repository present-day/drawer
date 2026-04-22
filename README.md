# @present-day/drawer

A flexible and performant React drawer component with smooth animations and customizable snap points.

## Features

- 🎯 **Flexible Snap Points** - Support for fractional heights, pixel values, and preset modes
- 🎬 **Smooth Animations** - Built with Framer Motion for 60fps animations
- 📱 **Mobile Optimized** - Touch-friendly drag gestures with proper momentum
- ♿ **Accessible** - ARIA-compliant with keyboard navigation support
- 🎨 **Customizable** - Tailwind CSS classes with full style control
- 🔧 **TypeScript** - Full type safety and autocomplete support

## Installation

```bash
npm install @present-day/drawer motion
# or
yarn add @present-day/drawer motion
# or
pnpm add @present-day/drawer motion
```

## Basic Usage

```tsx
import { Drawer } from '@present-day/drawer'
import { useState } from 'react'

function App() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Drawer</button>

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Content className="p-6">
          <Drawer.Handle />
          <h2>Hello World</h2>
          <p>This is a drawer!</p>
        </Drawer.Content>
      </Drawer>
    </>
  )
}
```

## Advanced Usage with Snap Points

```tsx
import { Drawer } from '@present-day/drawer'

function AdvancedExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Drawer
      open={isOpen}
      onOpenChange={setIsOpen}
      sizing={[0.3, 0.6, 0.9]} // 30%, 60%, 90% of screen height
      defaultSnapPoint={0.6}
    >
      <Drawer.Content className="p-6">
        <Drawer.Handle />
        <Drawer.Scrollable>
          <h2>Scrollable Content</h2>
          {/* Long content here */}
        </Drawer.Scrollable>
      </Drawer.Content>
    </Drawer>
  )
}
```

## API Reference

### Drawer Props

| Prop               | Type                      | Default  | Description                       |
| ------------------ | ------------------------- | -------- | --------------------------------- |
| `open`             | `boolean`                 | -        | Controls the open state           |
| `onOpenChange`     | `(open: boolean) => void` | -        | Called when open state changes    |
| `sizing`           | `DrawerSizing`            | `'auto'` | Snap point configuration          |
| `defaultSnapPoint` | `number`                  | -        | Initial snap point                |
| `dismissible`      | `boolean`                 | `true`   | Allow dismissing by dragging down |
| `modal`            | `boolean`                 | `true`   | Show overlay and lock body scroll |

### Components

- `Drawer.Content` - Main content container
- `Drawer.Handle` - Drag handle (optional)
- `Drawer.Scrollable` - Scrollable content area
- `Drawer.Overlay` - Background overlay (auto-rendered when modal=true)

## License

MIT
