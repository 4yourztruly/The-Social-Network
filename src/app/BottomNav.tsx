import { NAV_ITEMS, type Screen } from './navItems'

export type { Screen }

interface BottomNavProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
}

// Fixed to the true bottom of the physical viewport — not a flex child of
// the app shell — so it can never be dragged out of position by the
// shell's own height glitching (iOS standalone WKWebView's svh/dvh bugs,
// the keyboard opening, etc. — see useViewportHeight.ts). A same-sized
// spacer below reserves the space in normal flow so scrolling content
// never renders underneath it.
function NavBar({ screen, onNavigate }: BottomNavProps) {
  return (
    <nav className="flex border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
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

export function BottomNav({ screen, onNavigate }: BottomNavProps) {
  return (
    <>
      <div aria-hidden className="invisible shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavBar screen={screen} onNavigate={onNavigate} />
      </div>
      <div
        className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-xl md:max-w-4xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavBar screen={screen} onNavigate={onNavigate} />
      </div>
    </>
  )
}
