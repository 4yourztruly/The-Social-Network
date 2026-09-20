import { NAV_ITEMS, type Screen } from './navItems'

interface SidebarNavProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
}

// Desktop-only left rail — BottomNav stays the mobile nav (hidden at md+).
// Same screens, same handler, just a layout better suited to a mouse and a
// wide viewport: persistent, hoverable, with a dedicated Post button.
export function SidebarNav({ screen, onNavigate }: SidebarNavProps) {
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950 md:flex">
      <div className="px-3 py-3 text-lg font-bold">Football Social</div>
      {NAV_ITEMS.filter((item) => item.screen !== 'compose').map(({ screen: s, label, Icon }) => (
        <button
          key={s}
          onClick={() => onNavigate(s)}
          className={`flex cursor-pointer items-center gap-3 rounded-full px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900 ${
            screen === s
              ? 'font-semibold text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <Icon className="h-6 w-6" />
          {label}
        </button>
      ))}
      <button
        onClick={() => onNavigate('compose')}
        className={`mt-2 cursor-pointer rounded-full px-4 py-2.5 text-center text-[15px] font-semibold transition-colors ${
          screen === 'compose'
            ? 'bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900'
            : 'bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200'
        }`}
      >
        Post
      </button>
    </nav>
  )
}
