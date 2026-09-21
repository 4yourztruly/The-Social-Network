import { describe, expect, it } from 'vitest'
import { isDmAvailable, isFollowable, isViewableProfile, npcFollowsPlayer, tierForPersona } from './npcTier'
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

describe('npcFollowsPlayer / isDmAvailable', () => {
  it('a celeb with decent relationship follows the player, independent of followedByPlayer', () => {
    const npc = makeNpc({ persona: 'teammate', relationship: 40, followedByPlayer: false })
    expect(npcFollowsPlayer(npc)).toBe(true)
    expect(isDmAvailable(npc)).toBe(true)
  })

  it('a celeb with low relationship does not follow the player yet', () => {
    const npc = makeNpc({ persona: 'teammate', relationship: 5 })
    expect(npcFollowsPlayer(npc)).toBe(false)
  })

  it('media/commenters never follow back or are DMable, regardless of relationship', () => {
    expect(npcFollowsPlayer(makeNpc({ persona: 'tabloid', relationship: 100 }))).toBe(false)
    expect(npcFollowsPlayer(makeNpc({ persona: 'loyal_fan', relationship: 100 }))).toBe(false)
  })
})
