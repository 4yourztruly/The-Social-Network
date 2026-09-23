import { useEffect } from 'react'

// iOS's standalone (Home Screen) WKWebView has a long-documented bug: when
// the on-screen keyboard opens, it shrinks the viewport — and then never
// recomputes it back to full size once the keyboard closes, no matter the
// cause (a screen unmounting, or the keyboard's own native "Done" button).
// Neither plain CSS `dvh` nor a `resize`/`visualViewport` 'resize' listener
// reliably recovers from this — both were tried here and both still leave
// the shell (bottom nav included) stuck short of the true bottom edge.
//
// The actual fix (see https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d)
// is to force WebKit to re-measure by toggling `display` off and back on a
// genuinely full-viewport-height element — the synchronous reflow that
// triggers is what makes it recompute, nothing less forceful does. Run
// shortly after any text input/textarea blurs (140ms — long enough for the
// keyboard's own close animation to finish first).
const HEAL_DELAY_MS = 140

function healViewport() {
  const shell = document.querySelector<HTMLElement>('.app-shell')
  if (!shell) return
  const previousDisplay = shell.style.display
  shell.style.display = 'none'
  void shell.offsetHeight // forces the synchronous reflow that makes WebKit re-measure
  shell.style.display = previousDisplay
}

export function useViewportHeight() {
  useEffect(() => {
    let lastHeight = window.visualViewport?.height ?? window.innerHeight

    const setHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${height}px`)
      lastHeight = height
    }
    setHeight()

    // A resize that GROWS the viewport is the keyboard closing — heal
    // right away rather than waiting on focusout, in case that event
    // doesn't fire (or fires without a reliable target) for however this
    // particular close happened.
    const onResize = () => {
      const height = window.visualViewport?.height ?? window.innerHeight
      const grew = height > lastHeight
      setHeight()
      if (grew) healViewport()
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    window.visualViewport?.addEventListener('resize', onResize)

    // 'focusout' (bubbles) rather than 'blur' (doesn't) so one listener on
    // the document catches every input/textarea losing focus, however it
    // happens — the keyboard's Done button, tapping elsewhere, or a screen
    // unmounting (see blurActiveElement in App.tsx). Belt and suspenders
    // alongside the resize-grew check above: whichever signal actually
    // fires on a given device/iOS version triggers the heal.
    const onFocusOut = (e: FocusEvent) => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return
      window.setTimeout(() => {
        setHeight()
        healViewport()
      }, HEAL_DELAY_MS)
    }
    document.addEventListener('focusout', onFocusOut)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])
}
