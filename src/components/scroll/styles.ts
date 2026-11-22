const STYLE_ID = 'present-day-scroll-drawer'

// Injected at runtime rather than shipped as a stylesheet so the prototype
// works in any bundler without CSS handling. Part defaults use `:where()` so a
// consumer's single class always wins.
export const SCROLL_DRAWER_CSS = `
@keyframes scroll-drawer-backdrop { from { opacity: 0; } to { opacity: 1; } }
[data-scroll-drawer] {
  position: fixed; inset: 0; height: 100dvh; z-index: 50;
  overflow-x: hidden; overflow-y: auto; scrollbar-width: none;
  scroll-snap-type: y mandatory; overscroll-behavior: contain;
  -webkit-tap-highlight-color: transparent;
}
[data-scroll-drawer]::-webkit-scrollbar { display: none; }
[data-scroll-drawer] { scroll-timeline: --scroll-drawer y; }
[data-scroll-drawer-backdrop] {
  position: fixed; inset: 0; pointer-events: none;
  background: rgb(0 0 0 / 0.5); opacity: 0;
}
@supports (animation-timeline: scroll()) {
  [data-scroll-drawer-backdrop] { animation: scroll-drawer-backdrop linear both; animation-timeline: --scroll-drawer; }
}
[data-scroll-drawer-track] {
  position: relative; display: flex; flex-direction: column;
  justify-content: flex-end; min-height: 100dvh;
}
[data-scroll-drawer-spacer] {
  flex: none; display: block; width: 100%; padding: 0; border: 0; margin: 0;
  background: transparent; appearance: none; cursor: default;
}
[data-scroll-drawer-dismissible] [data-scroll-drawer-spacer] { scroll-snap-align: start; }
[data-scroll-drawer-sheet] { position: relative; scroll-snap-align: end; }
:where([data-scroll-drawer-sheet]) {
  flex: none; display: flex; flex-direction: column;
  max-height: calc(100dvh - var(--scroll-drawer-top-inset, 24px));
  outline: none; background: #fff; color: #111; border-radius: 16px 16px 0 0;
}
[data-scroll-drawer-marker] {
  position: absolute; left: 0; width: 1px; height: 1px; pointer-events: none;
  top: min(var(--scroll-drawer-snap), calc(100% - 1px));
  scroll-snap-align: start; scroll-margin-top: 100dvh;
}
:where([data-scroll-drawer-content]) {
  flex: 1 1 auto; min-height: 0; overflow: hidden; overscroll-behavior: auto;
  padding-bottom: calc(100dvh - var(--visual-viewport-height, 100dvh));
}
:where([data-scroll-drawer-full] [data-scroll-drawer-content]) { overflow-y: auto; }
:where([data-scroll-drawer-handle]) {
  flex: none; display: flex; justify-content: center; padding: 12px 0 8px;
  cursor: grab; touch-action: pan-y;
}
:where([data-scroll-drawer-handle])::before {
  content: ''; width: 40px; height: 4px; border-radius: 9999px;
  background: rgb(156 163 175 / 0.6);
}
`

export function injectScrollDrawerStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = SCROLL_DRAWER_CSS
  document.head.appendChild(style)
}
