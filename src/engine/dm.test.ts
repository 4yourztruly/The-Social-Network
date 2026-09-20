import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { generateDmReply } from './dm'
import { footballerPack } from '../content/careers/footballer'
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
    postingStyle: { emoji: 0.5, caps: 0.2, hashtags: 0.2 },
    recentLineIds: [],
    followedByPlayer: false,
    ...overrides,
  }
}

describe('generateDmReply', () => {
  const baseArgs = {
    reactionPool: footballerPack.reactionPool,
    playerDisplayName: 'Alex Rennick',
    orgName: 'Ashcombe United',
    now: 1000,
  }

  it('is deterministic for a given seed', () => {
    const npc = makeNpc({})
    const a = generateDmReply({ ...baseArgs, npc, rng: mulberry32(1) })
    const b = generateDmReply({ ...baseArgs, npc, rng: mulberry32(1) })
    expect(a).toEqual(b)
  })

  it('schedules the reply in the future', () => {
    const npc = makeNpc({})
    const result = generateDmReply({ ...baseArgs, npc, rng: mulberry32(2) })
    expect(result.dueAt).toBeGreaterThan(1000)
  })

  it('produces varied lines across repeated DMs instead of always the same one', () => {
    let npc = makeNpc({})
    const seen = new Set<string>()
    for (let seed = 1; seed < 15; seed++) {
      const result = generateDmReply({ ...baseArgs, npc, rng: mulberry32(seed) })
      seen.add(result.text)
      npc = { ...npc, recentLineIds: result.recentLineIds }
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})
