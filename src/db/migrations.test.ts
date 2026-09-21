import { describe, expect, it } from 'vitest'
import { migrateSaveData } from './migrations'

function v1Save() {
  return {
    version: 1,
    clock: 1000,
    player: {
      profileId: 'player',
      club: 'Ashcombe United',
      position: 'Forward',
      ratings: { finishing: 78 },
      fame: 55,
      morale: 60,
      form: 60,
      traits: [],
    },
    profiles: {
      player: { id: 'player', isPlayer: true, username: 'alexrennick' },
      npc_jamie: { id: 'npc_jamie', isPlayer: false, persona: 'teammate', username: 'jamie' },
    },
    posts: {},
    threads: {},
    scheduled: [],
    settings: { theme: 'system', aiEnabled: false, providers: [] },
  }
}

describe('migrateSaveData', () => {
  it('leaves an up-to-date save untouched', () => {
    const current = { version: 7, activityLog: [], undoStack: [], activities: {} }
    expect(migrateSaveData(current)).toEqual(current)
  })

  it('upgrades a v1 save all the way to v7, filling new fields with defaults', () => {
    const migrated = migrateSaveData(v1Save()) as Record<string, unknown>
    expect(migrated.version).toBe(7)
    expect(migrated.activityLog).toEqual([])
    expect(migrated.undoStack).toEqual([])
    expect(migrated.achievements).toEqual([])
    expect(migrated.mutedAccounts).toEqual([])
    expect(migrated.activities).toEqual({})
    expect(migrated.worldSettings).toEqual({ madness: 2, proactivity: 'medium' })
    expect(migrated.onboarded).toBe(true)

    const player = migrated.player as Record<string, unknown>
    expect(player.hype).toBe(50)
    expect(player.charisma).toBe(55)
    expect(player.reputation).toBe(60)
    expect(player.controversy).toBe(5)
    expect(player.humor).toBe(50)
    expect(player.aura).toBe(50)
    expect(player.xp).toBe(0)
    expect(player.career).toBe('footballer')
    // Pre-existing fields are preserved.
    expect(player.fame).toBe(55)

    const profiles = migrated.profiles as Record<string, Record<string, unknown>>
    expect(profiles.npc_jamie.vibe).toBe('teammate_bond')
    expect(profiles.player.vibe).toBeUndefined()

    // The old settings.providers field (which could carry an API key) must
    // never survive a migration.
    const settings = migrated.settings as Record<string, unknown>
    expect(settings.providers).toBeUndefined()
  })

  it('is idempotent', () => {
    const once = migrateSaveData(v1Save())
    const twice = migrateSaveData(once)
    expect(twice).toEqual(once)
  })

  it('upgrades a v2 save to v3+ without touching an already-set career', () => {
    const v2 = {
      version: 2,
      player: { career: 'rapper', profileId: 'player' },
      profiles: {},
      onboarded: undefined,
      settings: {},
    }
    const migrated = migrateSaveData(v2) as Record<string, unknown>
    expect(migrated.version).toBe(7)
    expect((migrated.player as Record<string, unknown>).career).toBe('rapper')
    expect(migrated.onboarded).toBe(true)
  })

  it('strips a leftover settings.providers field (containing a secret key) from a v3 save', () => {
    const v3 = {
      version: 3,
      settings: {
        theme: 'system',
        aiEnabled: true,
        providers: [{ id: 'p1', apiKey: 'sk-should-not-survive' }],
      },
    }
    const migrated = migrateSaveData(v3) as Record<string, unknown>
    expect(migrated.version).toBe(7)
    const settings = migrated.settings as Record<string, unknown>
    expect(settings.providers).toBeUndefined()
    expect(settings.theme).toBe('system')
  })

  it('adds an empty activities map to a v4 save that predates it', () => {
    const v4 = { version: 4, settings: { theme: 'system', aiEnabled: false } }
    const migrated = migrateSaveData(v4) as Record<string, unknown>
    expect(migrated.version).toBe(7)
    expect(migrated.activities).toEqual({})
  })

  it('adds humor/aura defaults to a v5 save that predates them', () => {
    const v5 = { version: 5, player: { fame: 55 }, settings: { theme: 'system', aiEnabled: false } }
    const migrated = migrateSaveData(v5) as Record<string, unknown>
    expect(migrated.version).toBe(7)
    const player = migrated.player as Record<string, unknown>
    expect(player.humor).toBe(50)
    expect(player.aura).toBe(50)
    expect(player.fame).toBe(55)
  })

  it('repairs a v6 save whose NPCs got stripped of persona/vibe/etc by the union bug', () => {
    const v6 = {
      version: 6,
      profiles: {
        player: { id: 'player', isPlayer: true, username: 'alexrennick' },
        // Exactly what the union bug left behind: no persona, no vibe, no
        // relationship, no followedByPlayer — indistinguishable from a
        // plain Profile except by id/bio.
        npc_tmz: {
          id: 'npc_tmz',
          isPlayer: false,
          username: 'TMZ_Official',
          displayName: 'TMZ',
          bio: 'Tabloid celeb news',
        },
      },
      settings: { theme: 'system', aiEnabled: false },
    }
    const migrated = migrateSaveData(v6) as Record<string, unknown>
    expect(migrated.version).toBe(7)
    const npc = (migrated.profiles as Record<string, Record<string, unknown>>).npc_tmz
    expect(npc.persona).toBe('tabloid')
    expect(npc.vibe).toBe('frenemy')
    expect(npc.followedByPlayer).toBe(false)
    expect(npc.recentLineIds).toEqual([])

    // The player's own profile is untouched — it never had persona and
    // shouldn't gain one.
    const player = (migrated.profiles as Record<string, Record<string, unknown>>).player
    expect(player.persona).toBeUndefined()
  })

  it('leaves an already-healthy NPC alone during the v6->v7 repair pass', () => {
    const v6 = {
      version: 6,
      profiles: {
        player: { id: 'player', isPlayer: true },
        npc_jamie: {
          id: 'npc_jamie',
          isPlayer: false,
          persona: 'teammate',
          vibe: 'teammate_bond',
          relationship: 77,
          followedByPlayer: true,
          recentLineIds: ['a', 'b'],
        },
      },
      settings: { theme: 'system', aiEnabled: false },
    }
    const migrated = migrateSaveData(v6) as Record<string, unknown>
    const npc = (migrated.profiles as Record<string, Record<string, unknown>>).npc_jamie
    expect(npc.relationship).toBe(77)
    expect(npc.followedByPlayer).toBe(true)
    expect(npc.recentLineIds).toEqual(['a', 'b'])
  })
})
