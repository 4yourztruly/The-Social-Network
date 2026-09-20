import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

// Light real-time tick (section 4.8) that materializes due ScheduledItems —
// comments and DMs — as soon as they're due. Fast enough that post comments
// (COMMENT_DELAY_RANGE_MS, now near-instant) don't sit waiting on the next
// tick; tickScheduler is a cheap no-op when nothing is due yet.
const TICK_INTERVAL_MS = 1000

export function useSchedulerTick() {
  useEffect(() => {
    const interval = setInterval(() => {
      useGameStore.getState().tickScheduler(Date.now())
    }, TICK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])
}
