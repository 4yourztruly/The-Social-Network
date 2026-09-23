import { useEffect } from 'react'

// Plain CSS `dvh` (see .app-shell in index.css) covers most of this, but
// iOS's standalone (Home Screen) WKWebView has been observed to not always
// recompute it when the on-screen keyboard closes via its own native
// "Done" button — as opposed to blurring because a screen unmounted (see
// blurActiveElement() in App.tsx, which handles that separate case). The
// visualViewport 'resize' event itself does fire reliably there even when
// the CSS unit doesn't follow it, so this measures it directly in JS and
// exposes it as --app-height, which `.app-shell` prefers over `dvh` once
// it's set. Live-updates on every resize (keyboard open AND close) — this
// is safe to do continuously now that the unmount-while-focused case is
// handled separately, which was the actual cause of past attempts at this
// getting stuck on a keyboard-shrunk value.
export function useViewportHeight() {
  useEffect(() => {
    const setHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${height}px`)
    }
    setHeight()
    window.addEventListener('resize', setHeight)
    window.addEventListener('orientationchange', setHeight)
    window.visualViewport?.addEventListener('resize', setHeight)
    return () => {
      window.removeEventListener('resize', setHeight)
      window.removeEventListener('orientationchange', setHeight)
      window.visualViewport?.removeEventListener('resize', setHeight)
    }
  }, [])
}
