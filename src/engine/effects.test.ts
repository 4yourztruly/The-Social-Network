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
    fame: 50,
    morale: 50,
    form: 50,
    traits: [],
    hype: 50,
    charisma: 50,
    reputation: 50,
    controversy: 50,
    humor: 50,
    aura: 50,
    xp: 0,
  }
}

describe('applyPlayerEffects', () => {
  it('applies fame/morale/form deltas', () => {
    const next = applyPlayerEffects(basePlayer(), [
      { type: 'fame', delta: 5 },
      { type: 'morale', delta: -3 },
      { type: 'form', delta: 2 },
    ])
    expect(next.fame).toBe(55)
    expect(next.morale).toBe(47)
    expect(next.form).toBe(52)
  })

  it('applies stat-targeted deltas to the named social stat', () => {
    const next = applyPlayerEffects(basePlayer(), [
      { type: 'stat', target: 'hype', delta: 10 },
      { type: 'stat', target: 'controversy', delta: 8 },
      { type: 'stat', target: 'humor', delta: 4 },
      { type: 'stat', target: 'aura', delta: 4 },
    ])
    expect(next.hype).toBe(60)
    expect(next.controversy).toBe(58)
    expect(next.humor).toBe(54)
    expect(next.aura).toBe(54)
  })

  it('clamps to [0, 100]', () => {
    const next = applyPlayerEffects(basePlayer(), [
      { type: 'fame', delta: 1000 },
      { type: 'stat', target: 'reputation', delta: -1000 },
    ])
    expect(next.fame).toBe(100)
    expect(next.reputation).toBe(0)
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
