import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

export function useTheme() {
  const theme = useGameStore((s) => s.settings.theme)

  useEffect(() => {
    const root = document.documentElement
    const apply = (dark: boolean) => root.classList.toggle('dark', dark)

    if (theme === 'dark') {
      apply(true)
      return
    }
    if (theme === 'light') {
      apply(false)
      return
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    apply(mql.matches)
    const listener = (e: MediaQueryListEvent) => apply(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [theme])
}
