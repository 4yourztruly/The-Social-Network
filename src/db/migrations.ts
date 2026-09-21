// Migrates a raw save object (parsed JSON, not yet validated) up to the
// current SaveGame shape. Runs before zod validation so older saves don't
// get rejected just for predating a field that now has a sane default.
// See PROJECT_SPEC.md section 10 ("SaveGame is versioned with migration
// functions") and section 17.7.

import { defaultVibeForPersona, defaultWorldSettings } from '../content/seed'
import { inferPersonaFromBio } from '../engine/personaInference'
import type { Persona } from '../types'

type RawRecord = Record<string, unknown>

function migrateV1toV2(raw: RawRecord): RawRecord {
  const player = { ...(raw.player as RawRecord) }
  player.hype ??= 50
  player.charisma ??= 55
  player.reputation ??= 60
  player.controversy ??= 5
  player.xp ??= 0

  const profiles = { ...(raw.profiles as Record<string, RawRecord>) }
  for (const [id, profile] of Object.entries(profiles)) {
    if (profile.isPlayer) continue
    if (profile.vibe === undefined) {
      profiles[id] = { ...profile, vibe: defaultVibeForPersona(profile.persona as Persona) }
    }
  }

  return {
    ...raw,
    version: 2,
    player,
    profiles,
    activityLog: raw.activityLog ?? [],
    undoStack: raw.undoStack ?? [],
    worldSettings: raw.worldSettings ?? defaultWorldSettings(),
    achievements: raw.achievements ?? [],
    mutedAccounts: raw.mutedAccounts ?? [],
  }
}

// Every pre-v3 save was football-only, and its world already reflects a
// deliberately-created profile — no need to force those players back
// through onboarding.
function migrateV2toV3(raw: RawRecord): RawRecord {
  const player = { ...(raw.player as RawRecord) }
  player.career ??= 'footballer'

  return {
    ...raw,
    version: 3,
    player,
    onboarded: raw.onboarded ?? true,
    // Pre-DM/stories saves predate these fields entirely.
    threads: raw.threads ?? {},
  }
}

// AI provider configs (including the API key) used to live inside
// settings.providers, which meant a key could end up in an exported save
// file. They now live in localStorage only (src/ai/keyStorage.ts) — this
// migration just drops the old field from any save that still has it. The
// player re-enters their key once in Settings; nothing else is lost.
function migrateV3toV4(raw: RawRecord): RawRecord {
  const settings = { ...(raw.settings as RawRecord) }
  delete settings.providers

  return {
    ...raw,
    version: 4,
    settings,
  }
}

// Adds "activities" (player-authored scenes with NPCs — see types.ts) and
// the `custom` flag on NPC profiles, both new. Pre-v5 saves simply have none.
function migrateV4toV5(raw: RawRecord): RawRecord {
  return {
    ...raw,
    version: 5,
    activities: raw.activities ?? {},
  }
}

// Adds player.humor/aura (gained from posts that land as funny/confident)
// and NPC.lastRelationshipChange (a caption for the relationship list).
function migrateV5toV6(raw: RawRecord): RawRecord {
  const player = { ...(raw.player as RawRecord) }
  player.humor ??= 50
  player.aura ??= 50

  return {
    ...raw,
    version: 6,
    player,
  }
}

// Repairs a schema bug (see saveSchema.ts's `profiles` union comment) that
// let z.union([profileSchema, npcSchema]) silently strip persona/vibe/
// relationship/followedByPlayer/etc from every NPC profile on load, any
// time the (previously non-strict) profileSchema was tried first and
// "matched" an NPC object by quietly stripping its unknown keys — so a
// save touched by that bug has NPCs indistinguishable from a plain Profile
// except by having no `persona`. Re-infers persona from name/bio (the same
// heuristic addCustomPerson uses) and refills the rest with safe, neutral
// defaults. Relationship/follow state from before the corruption can't be
// recovered — it was already gone by the time this runs — but this at
// least gets People/Follow/DM working again instead of staying broken.
function migrateV6toV7(raw: RawRecord): RawRecord {
  const profiles = { ...(raw.profiles as Record<string, RawRecord>) }
  for (const [id, profile] of Object.entries(profiles)) {
    if (profile.isPlayer) continue
    if (typeof profile.persona === 'string') continue // already a healthy NPC

    const persona = inferPersonaFromBio(
      typeof profile.displayName === 'string' ? profile.displayName : '',
      typeof profile.bio === 'string' ? profile.bio : '',
    )
    profiles[id] = {
      ...profile,
      persona,
      personality: profile.personality ?? [],
      relationship: profile.relationship ?? 0,
      vibe: profile.vibe ?? defaultVibeForPersona(persona),
      mood: profile.mood ?? 0,
      postingStyle: profile.postingStyle ?? { emoji: 0.4, caps: 0.1, hashtags: 0.1 },
      recentLineIds: profile.recentLineIds ?? [],
      followedByPlayer: profile.followedByPlayer ?? false,
    }
  }

  return {
    ...raw,
    version: 7,
    profiles,
  }
}

const MIGRATIONS: Record<number, (raw: RawRecord) => RawRecord> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
  4: migrateV4toV5,
  5: migrateV5toV6,
  6: migrateV6toV7,
}

export const CURRENT_SAVE_VERSION = 7

export function migrateSaveData(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  let data = raw as RawRecord
  let version = typeof data.version === 'number' ? data.version : 1
  while (version < CURRENT_SAVE_VERSION) {
    const migrate = MIGRATIONS[version]
    if (!migrate) break
    data = migrate(data)
    version = data.version as number
  }
  return data
}
