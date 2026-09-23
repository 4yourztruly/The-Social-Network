import { useEffect } from 'react'

// iOS's standalone (Home Screen) web app has historically unreliable
// svh/dvh support in its WKWebView — the CSS value can undercount the real
// screen height, leaving a gap of background below the app shell (and the
// bottom nav short of the true edge) instead of filling it. Measuring the
// actual visible viewport in JS and exposing it as a CSS var sidesteps the
// CSS unit entirely — this is the pixel height the browser itself reports,
// so it can't be wrong the way the CSS keyword can be.
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
