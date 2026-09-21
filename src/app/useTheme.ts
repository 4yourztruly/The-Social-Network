import { useEffect } from 'react'

// The app is dark-mode only now — no light/system option (see Settings,
// which no longer has a theme picker). Always applied, never toggled.
export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])
}
