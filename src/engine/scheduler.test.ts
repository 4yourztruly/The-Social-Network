import { describe, expect, it } from 'vitest'
import { splitDueItems } from './scheduler'
import type { ScheduledItem } from '../types'

function item(id: string, dueAt: number): ScheduledItem {
  return { id, dueAt, kind: 'comment', payload: {} }
}

describe('splitDueItems', () => {
  it('splits items at or before now into due, sorted ascending', () => {
    const items = [item('c', 300), item('a', 100), item('b', 200), item('future', 500)]
    const { due, remaining } = splitDueItems(items, 300)
    expect(due.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(remaining.map((i) => i.id)).toEqual(['future'])
  })

  it('returns everything as remaining when nothing is due yet', () => {
    const items = [item('a', 100), item('b', 200)]
    const { due, remaining } = splitDueItems(items, 0)
    expect(due).toEqual([])
    expect(remaining).toHaveLength(2)
  })

  it('returns everything as due when now is far in the future', () => {
    const items = [item('a', 100), item('b', 200)]
    const { due, remaining } = splitDueItems(items, 10_000)
    expect(due).toHaveLength(2)
    expect(remaining).toEqual([])
  })
})
