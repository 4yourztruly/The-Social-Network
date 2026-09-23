import { NAV_ITEMS, type Screen } from './navItems'

export type { Screen }

interface BottomNavProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
}

// A plain in-flow flex child of the app shell, not position:fixed itself —
// the SHELL (App.tsx's root) is the one pinned with `fixed inset-0` to the
// physical screen edges, immune to every iOS keyboard/viewport-unit quirk
// (several attempts at chasing `vh`/`svh`/`dvh` with JS all preceded this
// and all still left the nav stuck after the keyboard closed). Once the
// shell itself can't be the wrong size, being its last flex child is all
// this needs to always render flush with the true bottom edge.
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
