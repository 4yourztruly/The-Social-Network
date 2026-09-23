import { useEffect } from 'react'

// iOS's standalone (Home Screen) web app has historically unreliable
// svh/dvh support in its WKWebView — the CSS value can undercount the real
// screen height, leaving a gap of background below the app shell (and the
// bottom nav short of the true edge) instead of filling it. Measuring the
// actual visible viewport in JS and exposing it as a CSS var sidesteps the
// CSS unit entirely — this is the pixel height the browser itself reports,
// so it can't be wrong the way the CSS keyword can be.
//
// Deliberately only measured on mount and on orientationchange — NOT on
// every 'resize'/visualViewport 'resize'. Those also fire when the
// on-screen keyboard opens (e.g. typing a post or activity reply), which
// would shrink --app-height to the space above the keyboard; on iOS's
// standalone WKWebView that shrunk value has been observed to not reliably
// restore once the keyboard closes, permanently pushing the bottom nav up.
// Measuring once avoids ever picking up a keyboard-shrunk height at all.
export function useViewportHeight() {
  useEffect(() => {
    const setHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${height}px`)
    }
    setHeight()
    // Dimensions aren't final the instant orientationchange fires.
    const onOrientationChange = () => setTimeout(setHeight, 100)
    window.addEventListener('orientationchange', onOrientationChange)
    return () => window.removeEventListener('orientationchange', onOrientationChange)
  }, [])
}
