import { describe, expect, it } from 'vitest'
import { applyPlayerEffects, lastStatChangesFromEffects } from './effects'
import type { PlayerState } from '../types'

function basePlayer(): PlayerState {
  return {
    profileId: 'player',
    career: 'footballer',
    club: 'Ashcombe United',
    position: 'Forward',
    ratings: {},
    traits: [],
    humor: 50,
    aura: 50,
    xp: 0,
  }
}

describe('applyPlayerEffects', () => {
  it('applies stat-targeted deltas to the named social stat', () => {
    const next = applyPlayerEffects(basePlayer(), [
      { type: 'stat', target: 'humor', delta: 4 },
      { type: 'stat', target: 'aura', delta: 4 },
    ])
    expect(next.humor).toBe(54)
    expect(next.aura).toBe(54)
  })

  it('clamps to [0, 100]', () => {
    const next = applyPlayerEffects(basePlayer(), [
      { type: 'stat', target: 'humor', delta: 1000 },
      { type: 'stat', target: 'aura', delta: -1000 },
    ])
    expect(next.humor).toBe(100)
    expect(next.aura).toBe(0)
  })

  it('ignores followers/mood/relationship effects for humor/aura (handled elsewhere)', () => {
    const before = basePlayer()
    const next = applyPlayerEffects(before, [
      { type: 'followers', delta: 500 },
      { type: 'mood', target: 'npc_1', delta: 2 },
      { type: 'relationship', target: 'npc_1', delta: 5 },
    ])
    expect(next.humor).toBe(before.humor)
    expect(next.aura).toBe(before.aura)
  })

  it('always grants at least the base XP for taking an action', () => {
    const next = applyPlayerEffects(basePlayer(), [{ type: 'followers', delta: 500 }])
    expect(next.xp).toBeGreaterThan(0)
  })
})

describe('lastStatChangesFromEffects', () => {
  it('captures humor/aura deltas with the given reason and timestamp', () => {
    const changes = lastStatChangesFromEffects(
      [
        { type: 'stat', target: 'humor', delta: 4 },
        { type: 'stat', target: 'aura', delta: -2 },
      ],
      'From your post: "lol"',
      1000,
    )
    expect(changes.lastHumorChange).toEqual({ delta: 4, reason: 'From your post: "lol"', at: 1000 })
    expect(changes.lastAuraChange).toEqual({ delta: -2, reason: 'From your post: "lol"', at: 1000 })
  })

  it('ignores zero deltas and non-stat effects', () => {
    const changes = lastStatChangesFromEffects(
      [
        { type: 'stat', target: 'humor', delta: 0 },
        { type: 'followers', delta: 20 },
      ],
      'reason',
      1000,
    )
    expect(changes.lastHumorChange).toBeUndefined()
    expect(changes.lastAuraChange).toBeUndefined()
  })
})
