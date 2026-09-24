import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../engine/rng'
import { padCelebs } from './celebPool'

describe('padCelebs', () => {
  it('tops up to 10 with no repeats, an even gender split and several professions', () => {
    const out = padCelebs([{ name: 'Zendaya' }, { name: 'Someone Else' }], mulberry32(7))
    expect(out.length).toBe(10)
    const added = out.slice(2)
    expect(added.length).toBe(8)
    const names = out.map((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
    expect(new Set(names).size).toBe(10) // Zendaya never re-added
    expect(new Set(added.map((c) => c.description)).size).toBeGreaterThanOrEqual(5)
  })

  it('leaves 10+ untouched', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ name: `Person ${i}` }))
    expect(padCelebs(ten, mulberry32(1))).toEqual(ten)
  })
})
