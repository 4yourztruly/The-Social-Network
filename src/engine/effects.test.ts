import { describe, expect, it } from 'vitest'
import { applyPlayerEffects } from './effects'
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

  it('ignores followers/mood/relationship effects (handled elsewhere)', () => {
    const before = basePlayer()
    const next = applyPlayerEffects(before, [
      { type: 'followers', delta: 500 },
      { type: 'mood', target: 'npc_1', delta: 2 },
      { type: 'relationship', target: 'npc_1', delta: 5 },
    ])
    expect(next).toEqual(before)
  })
})
