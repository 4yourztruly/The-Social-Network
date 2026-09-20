import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { pickPrompt, rollTier, tierOutcome } from './randomEncounter'

describe('pickPrompt', () => {
  it('never returns a celeb-required prompt when none is available', () => {
    for (let seed = 0; seed < 30; seed++) {
      const prompt = pickPrompt(mulberry32(seed), false)
      expect(prompt.requiresCeleb).toBeFalsy()
    }
  })

  it('can return celeb prompts when one is available', () => {
    const seen = new Set<boolean>()
    for (let seed = 0; seed < 30; seed++) {
      seen.add(!!pickPrompt(mulberry32(seed), true).requiresCeleb)
    }
    expect(seen.has(true)).toBe(true)
  })
})

describe('rollTier', () => {
  it('bold choices land bad more often than safe choices', () => {
    let boldBad = 0
    let safeBad = 0
    const N = 500
    for (let i = 0; i < N; i++) {
      if (rollTier(mulberry32(i), 'bold') === 'bad') boldBad++
      if (rollTier(mulberry32(i), 'safe') === 'bad') safeBad++
    }
    expect(boldBad).toBeGreaterThan(safeBad)
  })
})

describe('tierOutcome', () => {
  it('good tiers gain followers, bad tiers lose them', () => {
    expect(tierOutcome('good', 10_000).followerDelta).toBeGreaterThan(0)
    expect(tierOutcome('bad', 10_000).followerDelta).toBeLessThan(0)
    expect(tierOutcome('neutral', 10_000).followerDelta).toBe(0)
  })

  it('bad tiers carry newsworthy tags, good/neutral do not', () => {
    expect(tierOutcome('bad', 10_000).tags).toContain('controversial')
    expect(tierOutcome('good', 10_000).tags).toEqual([])
  })

  it('follower swings scale with current follower count', () => {
    const small = tierOutcome('good', 5_000).followerDelta
    const big = tierOutcome('good', 50_000).followerDelta
    expect(big).toBeGreaterThan(small)
  })
})
