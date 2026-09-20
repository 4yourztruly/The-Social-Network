import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { applyPersonalityVoice } from './voice'
import type { NPC } from '../types'

function makeNpc(overrides: Partial<NPC>): NPC {
  return {
    id: 'npc_1',
    username: 'npc1',
    displayName: 'NPC One',
    bio: '',
    avatar: { kind: 'initials', value: 'N1' },
    verified: false,
    followers: 1000,
    following: 10,
    joinedAt: 0,
    isPlayer: false,
    persona: 'loyal_fan',
    personality: [],
    relationship: 30,
    vibe: 'fan',
    mood: 0,
    postingStyle: { emoji: 0, caps: 0, hashtags: 0 },
    recentLineIds: [],
    followedByPlayer: false,
    ...overrides,
  }
}

describe('applyPersonalityVoice', () => {
  it('strips softeners for blunt/contrarian personalities', () => {
    const npc = makeNpc({ personality: ['blunt'] })
    const result = applyPersonalityVoice('not impressed tbh', npc, mulberry32(1))
    expect(result).toBe('not impressed')
  })

  it('leaves non-blunt personalities untouched by softener stripping', () => {
    const npc = makeNpc({ personality: ['optimistic'], postingStyle: { emoji: 0, caps: 0, hashtags: 0 } })
    const result = applyPersonalityVoice('not impressed tbh', npc, mulberry32(1))
    expect(result).toBe('not impressed tbh')
  })

  it('is deterministic for a given seed', () => {
    const npc = makeNpc({ personality: ['jokester'], postingStyle: { emoji: 1, caps: 0, hashtags: 0 } })
    const a = applyPersonalityVoice('good one', npc, mulberry32(5))
    const b = applyPersonalityVoice('good one', npc, mulberry32(5))
    expect(a).toBe(b)
  })

  it('can append a trait emoji when posting style leans emoji-heavy', () => {
    const npc = makeNpc({ personality: ['jokester'], postingStyle: { emoji: 1, caps: 0, hashtags: 0 } })
    let sawEmoji = false
    for (let seed = 1; seed < 30; seed++) {
      const result = applyPersonalityVoice('good one', npc, mulberry32(seed))
      if (result !== 'good one') sawEmoji = true
    }
    expect(sawEmoji).toBe(true)
  })

  it('never adds an emoji when posting style has none', () => {
    const npc = makeNpc({ personality: ['jokester'], postingStyle: { emoji: 0, caps: 0, hashtags: 0 } })
    for (let seed = 1; seed < 30; seed++) {
      expect(applyPersonalityVoice('good one', npc, mulberry32(seed))).toBe('good one')
    }
  })

  it('does not shout for a measured/discreet personality even with high caps style', () => {
    const npc = makeNpc({ personality: ['measured'], postingStyle: { emoji: 0, caps: 1, hashtags: 0 } })
    for (let seed = 1; seed < 30; seed++) {
      expect(applyPersonalityVoice('noted', npc, mulberry32(seed))).toBe('noted')
    }
  })
})
