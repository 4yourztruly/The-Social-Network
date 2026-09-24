import type { NPC, Persona } from '../types'

export type NpcTier = 'celeb' | 'commenter' | 'media'

// Three tiers of "people" in the world, per persona:
//  - celeb: named individuals with a real relationship to the player —
//    celebrities the player added to their universe (plus any legacy
//    teammate/coach/agent/rival from older saves). Followable, DMable (once they follow back),
//    have a viewable profile with a relationship bar, and author their own
//    posts/stories.
//  - commenter: the general public — loyal_fan/hater/meme_account. They only
//    ever comment/reply under posts; no viewable profile, no follow, no DM,
//    and they never author their own top-level posts/stories.
//  - media: tabloid/insider/match_reporter. Viewable profile (that's where
//    their news/rumor posts live) and they author their own posts, but like
//    commenters they can't be followed or DMed.
const TIER_BY_PERSONA: Record<Persona, NpcTier> = {
  teammate: 'celeb',
  coach: 'celeb',
  agent: 'celeb',
  rival: 'celeb',
  loyal_fan: 'commenter',
  hater: 'commenter',
  meme_account: 'commenter',
  match_reporter: 'media',
  insider: 'media',
  tabloid: 'media',
  celebrity: 'celeb',
}

export function tierForPersona(persona: Persona): NpcTier {
  return TIER_BY_PERSONA[persona]
}

export function isViewableProfile(npc: NPC): boolean {
  return tierForPersona(npc.persona) !== 'commenter'
}

export function isFollowable(npc: NPC): boolean {
  return tierForPersona(npc.persona) === 'celeb'
}

// A celeb "follows back" once the relationship is decent enough — this
// isn't gated on the player having followed first (a celeb can already be
// following the player from the start, if their seeded relationship is
// already above the bar). Only celebs are ever DMable; media/commenters
// never are, regardless of relationship.
const FOLLOW_BACK_RELATIONSHIP_THRESHOLD = 20

export function npcFollowsPlayer(npc: NPC): boolean {
  return tierForPersona(npc.persona) === 'celeb' && npc.relationship >= FOLLOW_BACK_RELATIONSHIP_THRESHOLD
}

export function isDmAvailable(npc: NPC): boolean {
  return npcFollowsPlayer(npc)
}
