import { useEffect, useRef } from 'react'
import { NAV_ITEMS, type Screen } from './navItems'

export type { Screen }

interface BottomNavProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
}

function NavBar({ screen, onNavigate, navRef }: BottomNavProps & { navRef?: React.RefObject<HTMLElement | null> }) {
  return (
    <nav
      ref={navRef}
      className="flex border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
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

// Every previous attempt at this (CSS `dvh`, JS-measured height, forced
// reflow, a `fixed` shell) tried to make some ancestor's HEIGHT correctly
// track the keyboard opening/closing on iOS — and kept finding new ways to
// get that stuck. This sidesteps the question of "how tall is everything"
// entirely: `window.visualViewport` reports the ACTUAL currently-visible
// rectangle, live, on every change (keyboard opening/closing/animating,
// the page panning to reveal a focused field, Safari's own chrome
// showing/hiding) — no recomputation to get stuck on, because nothing is
// ever cached; it's re-read from the browser on every single event. The
// nav is pinned to the bottom of THAT rectangle directly, continuously, via
// a transform — not to any element's height.
export function BottomNav({ screen, onNavigate }: BottomNavProps) {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const nav = navRef.current
      if (!nav) return
      // How far the visible rectangle's bottom edge sits above the true
      // layout-viewport bottom (0 when nothing — no keyboard, no chrome —
      // is covering any of it).
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
    <>
      {/* Reserves the nav's own height in normal flow so scrolling content
          never renders underneath the real, fixed copy below. */}
      <div aria-hidden className="invisible shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavBar screen={screen} onNavigate={onNavigate} />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-xl md:max-w-4xl">
        <NavBar screen={screen} onNavigate={onNavigate} navRef={navRef} />
      </div>
    </>
  )
}
