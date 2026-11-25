/**
 * Every open drawer, in the order it opened, whether or not it stacks. Escape
 * goes to the top one only, so a key pressed with focus in a sheet behind
 * still closes the sheet in front.
 */
export type Layer = {
  sheet: HTMLElement
  modal: boolean
  /** Where focus returns when this drawer closes, resolved at that time. */
  returnTarget: () => Element | null
  onEscape: (event: KeyboardEvent) => void
}

const layers: Layer[] = []

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  let top: Layer | undefined
  for (let i = layers.length - 1; i >= 0 && !top; i--) {
    const layer = layers[i]
    if (layer?.modal) top = layer
  }
  // Modeless drawers don't own the keyboard; one only hears Escape from inside.
  if (!top && event.target instanceof Node) {
    for (let i = layers.length - 1; i >= 0 && !top; i--) {
      const layer = layers[i]
      if (layer?.sheet.contains(event.target)) top = layer
    }
  }
  top?.onEscape(event)
}

/** The topmost open drawer whose sheet holds `node`. */
export function layerContaining(node: Node): Layer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]
    if (layer?.sheet.contains(node)) return layer
  }
  return null
}

/** Adds a drawer on top. `leave` returns the drawer that was just below it. */
export function openLayer(layer: Layer): { leave: () => Layer | null } {
  if (layers.length === 0) document.addEventListener('keydown', onKeyDown)
  layers.push(layer)
  return {
    leave: () => {
      const i = layers.indexOf(layer)
      if (i === -1) return null
      layers.splice(i, 1)
      if (layers.length === 0) {
        document.removeEventListener('keydown', onKeyDown)
      }
      return layers[i - 1] ?? null
    },
  }
}
