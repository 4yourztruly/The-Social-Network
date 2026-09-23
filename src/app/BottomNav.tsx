import { useEffect, useRef } from 'react'
import { NAV_ITEMS, type Screen } from './navItems'

export type { Screen }

interface BottomNavProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
}

// A single, plain in-flow flex child of the app shell (the shell itself is
// `fixed inset-0` — see App.tsx — so this already sits flush with the true
// bottom edge at rest, no separate fixed/spacer copy needed for that part).
//
// The one thing normal flow can't handle is the on-screen keyboard: iOS
// doesn't resize anything when it opens, it just changes which part of the
// screen is currently visible (window.visualViewport). So on top of the
// normal layout position, a live transform nudges this exact element to
// stay inside whatever's actually visible right now — read fresh from the
// browser on every keyboard open/close/animation frame, nothing cached or
// computed to get stuck on.
export function BottomNav({ screen, onNavigate }: BottomNavProps) {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const nav = navRef.current
      if (!nav) return
      // How far the visible rectangle's bottom edge sits above the true
      // layout-viewport bottom (0 when nothing — no keyboard, no browser
      // chrome — is covering any of it).
      const coveredBy = window.innerHeight - (vv.height + vv.offsetTop)
      nav.style.transform = coveredBy > 0.5 ? `translateY(-${coveredBy}px)` : ''
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <nav
      ref={navRef}
      className="relative flex shrink-0 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map(({ screen: s, label, Icon }) => (
        <button
          key={s}
          onClick={() => onNavigate(s)}
          className="flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900"
        >
          <Icon
            className={`h-6 w-6 ${
              screen === s ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400'
            }`}
          />
          <span
            className={`text-[11px] ${
              screen === s ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-400'
            }`}
          >
            {label}
          </span>
        </button>
      ))}
    </nav>
  )
}
