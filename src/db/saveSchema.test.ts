import { describe, expect, it } from 'vitest'
import { saveGameSchema } from './saveSchema'

// Regression test for a bug where z.union([profileSchema, npcSchema]) with a
// non-strict profileSchema would silently "match" NPC objects too (zod's
// default object schema strips unknown keys instead of failing), stripping
// persona/vibe/relationship/followedByPlayer/etc from every NPC on every
// save round-trip through IndexedDB — which made isNPC() return false for
// all of them, emptying the People list and breaking Follow/DM app-wide.

function baseProfileFields(id: string, isPlayer: boolean) {
  return {
    id,
    username: id,
    displayName: id,
    bio: '',
    avatar: { kind: 'initials' as const, value: 'AB' },
    verified: false,
    followers: 100,
    following: 10,
    joinedAt: 0,
    isPlayer,
  }
}

function makeNpcRaw(id: string) {
  return {
    ...baseProfileFields(id, false),
    persona: 'loyal_fan',
    personality: ['warm'],
    relationship: 42,
    vibe: 'friend',
    mood: 0,
    postingStyle: { emoji: 0.4, caps: 0.1, hashtags: 0.1 },
    recentLineIds: [],
    followedByPlayer: true,
  }
}

function makeSaveGame(profiles: Record<string, unknown>) {
  return {
    version: 6,
    clock: 0,
    player: {
      profileId: 'player',
      career: 'footballer',
      club: 'Ashcombe United',
      position: 'Forward',
      ratings: { finishing: 78 },
      traits: [],
      humor: 50,
      aura: 50,
      xp: 0,
    },
    profiles,
    posts: {},
    threads: {},
    scheduled: [],
    settings: { theme: 'system', aiEnabled: false },
    activityLog: [],
    undoStack: [],
    worldSettings: { madness: 2, proactivity: 'medium' },
    achievements: [],
    mutedAccounts: [],
    activities: {},
    onboarded: true,
  }
}

describe('saveGameSchema profiles union', () => {
  it('keeps persona/vibe/relationship/followedByPlayer on an NPC after parsing', () => {
    const raw = makeSaveGame({
      player: baseProfileFields('player', true),
      npc_1: makeNpcRaw('npc_1'),
    })
    const result = saveGameSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (!result.success) return

    const npc = result.data.profiles.npc_1 as Record<string, unknown>
    expect(npc.persona).toBe('loyal_fan')
    expect(npc.vibe).toBe('friend')
    expect(npc.relationship).toBe(42)
    expect(npc.followedByPlayer).toBe(true)
  })

  it('still parses the plain player profile correctly', () => {
    const raw = makeSaveGame({
      player: baseProfileFields('player', true),
      npc_1: makeNpcRaw('npc_1'),
    })
    const result = saveGameSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (!result.success) return

    const player = result.data.profiles.player as Record<string, unknown>
    expect(player.isPlayer).toBe(true)
    expect(player).not.toHaveProperty('persona')
  })

  it('rejects a profile missing required NPC fields as well as required profile fields', () => {
    const raw = makeSaveGame({
      broken: { id: 'broken' },
    })
    const result = saveGameSchema.safeParse(raw)
    expect(result.success).toBe(false)
  })
})
