import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import {
  coverageChance,
  MEDIA_COVERAGE_TAGS,
  pickMediaOutlet,
  templatedActivityBeat,
  templatedActivityOpening,
} from './activity'
import type { NPC } from '../types'

function makeNpc(overrides: Partial<NPC>): NPC {
  return {
    id: 'npc_1',
    username: 'npc1',
    displayName: 'Jamie',
    bio: '',
    avatar: { kind: 'initials', value: 'J' },
    verified: false,
    followers: 1000,
    following: 10,
    joinedAt: 0,
    isPlayer: false,
    persona: 'loyal_fan',
    personality: [],
    relationship: 40,
    vibe: 'romantic',
    mood: 0,
    postingStyle: { emoji: 0, caps: 0, hashtags: 0 },
    recentLineIds: [],
    followedByPlayer: true,
    ...overrides,
  }
}

describe('templatedActivityOpening', () => {
  it('names every participant', () => {
    const line = templatedActivityOpening('Dinner date', [makeNpc({ displayName: 'Jamie' }), makeNpc({ id: 'npc_2', displayName: 'Luca' })])
    expect(line).toContain('Jamie')
    expect(line).toContain('Luca')
  })

  it('returns the raw description for a solo activity', () => {
    expect(templatedActivityOpening('Solo run', [])).toBe('Solo run')
  })
})

describe('templatedActivityBeat', () => {
  it('is deterministic for a given seed', () => {
    const npc = makeNpc({})
    const a = templatedActivityBeat(mulberry32(7), 'Be charming', [npc])
    const b = templatedActivityBeat(mulberry32(7), 'Be charming', [npc])
    expect(a).toBe(b)
  })

  it('falls back to a generic line with no participants', () => {
    const line = templatedActivityBeat(mulberry32(1), 'Be honest', [])
    expect(line.length).toBeGreaterThan(0)
  })
})

describe('pickMediaOutlet', () => {
  it('prefers tabloid over insider over match_reporter', () => {
    const npcs = [makeNpc({ id: 'a', persona: 'match_reporter' }), makeNpc({ id: 'b', persona: 'tabloid' })]
    expect(pickMediaOutlet(npcs)?.persona).toBe('tabloid')
  })

  it('returns null when no media persona is present', () => {
    expect(pickMediaOutlet([makeNpc({ persona: 'teammate' })])).toBeNull()
  })
})

describe('coverageChance', () => {
  it('is zero for tags with nothing newsworthy', () => {
    expect(coverageChance(['training'], 5)).toBe(0)
  })

  it('is positive for a newsworthy tag and increases with risk and length', () => {
    const base = coverageChance(['party'], 1)
    expect(base).toBeGreaterThan(0)
    expect(coverageChance(['party', 'controversial'], 1)).toBeGreaterThan(base)
    expect(coverageChance(['party'], 5)).toBeGreaterThan(base)
  })

  it('never exceeds 0.8', () => {
    expect(coverageChance(['party', 'controversial', 'scandal_leak', ...MEDIA_COVERAGE_TAGS], 10)).toBeLessThanOrEqual(0.8)
  })
})
