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

// Celebs and the news/tabloid outlets can be messaged directly — there's
// no follow-back requirement. Commenters (the general public) never can.
export function isDmAvailable(npc: NPC): boolean {
  return tierForPersona(npc.persona) !== 'commenter'
}

// A celeb at or above this relationship (the green part of the bar) may
// message the player first, unprompted. See store's celeb outreach.
export const OUTREACH_MIN_RELATIONSHIP = 25

export function canMessageFirst(npc: NPC): boolean {
  return tierForPersona(npc.persona) === 'celeb' && npc.relationship >= OUTREACH_MIN_RELATIONSHIP
}
