const STYLE_ID = 'present-day-scroll-drawer'

// Injected at runtime rather than shipped as a stylesheet so the engine works
// in any bundler without CSS handling. Anything a consumer may restyle sits in
// `:where()`, so a single class wins over it.
export const SCROLL_DRAWER_CSS = `
@keyframes scroll-drawer-backdrop { from { opacity: var(--scroll-drawer-backdrop-min, 0); } to { opacity: 1; } }
[data-scroll-drawer] {
  position: fixed; inset: 0; z-index: 50;
  overflow-x: hidden; overflow-y: auto; scrollbar-width: none;
  scroll-snap-type: y mandatory; overscroll-behavior: contain;
  -webkit-tap-highlight-color: transparent;
  scroll-timeline: --scroll-drawer y;
}
[data-scroll-drawer]::-webkit-scrollbar { display: none; }
/* Hit-testing skips the scroller, but a wheel or pan on the sheet still chains up to it. */
[data-scroll-drawer-modeless] { pointer-events: none; }
/* Children, not the sheet: a sheet narrower than the screen leaves its sides to the page. */
[data-scroll-drawer-modeless] [data-scroll-drawer-sheet] > :not([data-scroll-drawer-markers]) { pointer-events: auto; }
[data-scroll-drawer-root] { timeline-scope: --scroll-drawer; }
/* A pinned sheet's lowest stop is scroll progress 0, which would leave a modal with no dim at all. */
:where([data-scroll-drawer-root][data-scroll-drawer-pinned]) { --scroll-drawer-backdrop-min: 0.4; }
[data-scroll-drawer-backdrop] { position: fixed; inset: 0; z-index: 50; pointer-events: none; }
:where([data-scroll-drawer-backdrop]) { background: rgb(0 0 0 / 0.5); opacity: var(--scroll-drawer-backdrop-min, 0); }
[data-scroll-drawer-backdrop][data-scroll-drawer-backdrop-static] { opacity: 1; }
@supports (animation-timeline: scroll()) and (timeline-scope: --a) {
  [data-scroll-drawer-backdrop]:not([data-scroll-drawer-backdrop-static]) {
    animation: scroll-drawer-backdrop linear both; animation-timeline: --scroll-drawer;
    animation-range: var(--scroll-drawer-fade-start, 0px) var(--scroll-drawer-fade-end, 100%);
  }
}
[data-scroll-drawer-track] {
  position: relative; display: flex; flex-direction: column;
  justify-content: flex-end; min-height: var(--scroll-drawer-vh, 100dvh);
}
[data-scroll-drawer-spacer] {
  flex: none; display: block; width: 100%; padding: 0; border: 0; margin: 0;
  background: transparent; appearance: none; cursor: default;
}
[data-scroll-drawer-dismissible] [data-scroll-drawer-spacer] { scroll-snap-align: start; }
[data-scroll-drawer-sheet] { position: relative; flex: none; scroll-snap-align: end; box-sizing: border-box; }
:where([data-scroll-drawer-sheet]) {
  display: flex; flex-direction: column; outline: none;
}
[data-scroll-drawer-marker] {
  position: absolute; left: 0; width: 1px; height: 1px; pointer-events: none;
  top: min(var(--scroll-drawer-snap), calc(100% - 1px));
  scroll-snap-align: start; scroll-margin-top: var(--scroll-drawer-vh, 100dvh);
}
[data-scroll-drawer-sequential] :is([data-scroll-drawer-marker], [data-scroll-drawer-sheet], [data-scroll-drawer-spacer]) { scroll-snap-stop: always; }
[data-scroll-drawer-handle-only] [data-drawer-content] > :not([data-drawer-handle]):not([data-drawer-scroll]) { touch-action: none; }
:where([data-scroll-drawer-content]) {
  flex: 1 1 auto; min-height: 0; overflow: hidden; overscroll-behavior: auto;
  padding-bottom: calc(100dvh - var(--visual-viewport-height, 100dvh));
}
:where([data-scroll-drawer-full] [data-scroll-drawer-content]) { overflow-y: auto; }
:where([data-scroll-drawer-content-scroll="always"] [data-scroll-drawer-content]) {
  overflow-y: auto;
  padding-bottom: calc(var(--scroll-drawer-hidden, 0px) + 100dvh - var(--visual-viewport-height, 100dvh));
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
