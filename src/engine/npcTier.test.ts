import { describe, expect, it } from 'vitest'
import { canMessageFirst, isDmAvailable, isFollowable, isViewableProfile, tierForPersona } from './npcTier'
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
    relationship: 0,
    vibe: 'fan',
    mood: 0,
    postingStyle: { emoji: 0, caps: 0, hashtags: 0 },
    recentLineIds: [],
    followedByPlayer: false,
    ...overrides,
  }
}

describe('tierForPersona', () => {
  it('classifies known individuals as celeb', () => {
    expect(tierForPersona('teammate')).toBe('celeb')
    expect(tierForPersona('coach')).toBe('celeb')
    expect(tierForPersona('agent')).toBe('celeb')
    expect(tierForPersona('rival')).toBe('celeb')
  })

  it('classifies the general public as commenter', () => {
    expect(tierForPersona('loyal_fan')).toBe('commenter')
    expect(tierForPersona('hater')).toBe('commenter')
    expect(tierForPersona('meme_account')).toBe('commenter')
  })

  it('classifies news accounts as media', () => {
    expect(tierForPersona('tabloid')).toBe('media')
    expect(tierForPersona('insider')).toBe('media')
    expect(tierForPersona('match_reporter')).toBe('media')
  })
})

describe('isViewableProfile / isFollowable', () => {
  it('commenters have no viewable profile and are not followable', () => {
    const npc = makeNpc({ persona: 'loyal_fan' })
    expect(isViewableProfile(npc)).toBe(false)
    expect(isFollowable(npc)).toBe(false)
  })

  it('media profiles are viewable but not followable', () => {
    const npc = makeNpc({ persona: 'tabloid' })
    expect(isViewableProfile(npc)).toBe(true)
    expect(isFollowable(npc)).toBe(false)
  })

  it('celebs are viewable and followable', () => {
    const npc = makeNpc({ persona: 'teammate' })
    expect(isViewableProfile(npc)).toBe(true)
    expect(isFollowable(npc)).toBe(true)
  })
})

describe('isDmAvailable / canMessageFirst', () => {
  it('celebs and media can be DMed with no follow-back requirement, at any relationship', () => {
    expect(isDmAvailable(makeNpc({ persona: 'celebrity', relationship: 0, followedByPlayer: false }))).toBe(true)
    expect(isDmAvailable(makeNpc({ persona: 'teammate', relationship: -50 }))).toBe(true)
    expect(isDmAvailable(makeNpc({ persona: 'tabloid' }))).toBe(true)
    expect(isDmAvailable(makeNpc({ persona: 'match_reporter' }))).toBe(true)
  })

  it('commenters can never be DMed', () => {
    expect(isDmAvailable(makeNpc({ persona: 'loyal_fan', relationship: 100 }))).toBe(false)
    expect(isDmAvailable(makeNpc({ persona: 'hater' }))).toBe(false)
    expect(isDmAvailable(makeNpc({ persona: 'meme_account' }))).toBe(false)
  })

  it('only a celeb at 25%+ relationship may message first', () => {
    expect(canMessageFirst(makeNpc({ persona: 'celebrity', relationship: 25 }))).toBe(true)
    expect(canMessageFirst(makeNpc({ persona: 'celebrity', relationship: 24 }))).toBe(false)
    expect(canMessageFirst(makeNpc({ persona: 'tabloid', relationship: 100 }))).toBe(false)
    expect(canMessageFirst(makeNpc({ persona: 'loyal_fan', relationship: 100 }))).toBe(false)
  })
})
