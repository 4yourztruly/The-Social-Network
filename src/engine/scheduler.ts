import type { ScheduledItem } from '../types'

export interface DueSplit {
  due: ScheduledItem[]
  remaining: ScheduledItem[]
}

// Pure split of a ScheduledItem queue into what's due now vs. what isn't.
// `due` is sorted ascending by dueAt so callers can materialize in order.
export function splitDueItems(scheduled: readonly ScheduledItem[], now: number): DueSplit {
  const due: ScheduledItem[] = []
  const remaining: ScheduledItem[] = []
  for (const item of scheduled) {
    if (item.dueAt <= now) due.push(item)
    else remaining.push(item)
  }
  due.sort((a, b) => a.dueAt - b.dueAt)
  return { due, remaining }
}
