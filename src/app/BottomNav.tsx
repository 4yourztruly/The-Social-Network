import { NAV_ITEMS, type Screen } from './navItems'

export type { Screen }

interface BottomNavProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
}

// Deliberately a plain in-flow flex child of the app shell (NOT
// position:fixed) — iOS WKWebView has a well-known bug where a fixed
// element can visually detach and freeze in place after a nested
// overflow-y-auto pane (Compose, PostThread, Profile, ...) is scrolled and
// then navigated away from mid-scroll. The shell itself never scrolls
// (html/body/#root are overflow:hidden — see index.css), and its own
// height is plain CSS `dvh` (the app-shell class, also index.css) rather
// than anything JS-measured, so this being the shell's last flex child is
// enough to keep it pinned to the true bottom edge.
export function BottomNav({ screen, onNavigate }: BottomNavProps) {
  return (
    <nav
      className="flex shrink-0 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
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
