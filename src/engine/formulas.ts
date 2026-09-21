// Deterministic, seeded-RNG-driven formulas for engagement numbers and stat
// deltas. Nothing here reads from AI output — see PROJECT_SPEC.md section
// 17.4 "numbers must be consistent" and section 17.7 "all deltas are
// computed by deterministic functions".

import type { Effect } from '../types'
import type { RNG } from './rng'
import { randomInt } from './rng'

// Canonical tag names — same across every career pack, derived purely from
// the keyword tagger (no explicit post-type picker; see PROJECT_SPEC.md
// section 4.3 — composing is free text, tags come from what's written).
const TAG_ENGAGEMENT_MULTIPLIER: Record<string, number> = {
  big_moment: 1.4,
  huge_moment: 1.9,
  win: 1.2,
  loss: 0.8,
  rivalry: 1.3,
  controversial: 1.7,
  party: 1.3,
  funny: 1.3,
  aura_moment: 1.3,
}

export interface Engagement {
  likes: number
  reposts: number
}

// `socialScore` is the player's current (humor + aura) / 2 — the closer a
// player is to being funny/iconic, the more a post naturally lands with
// their existing audience.
export function estimateEngagement(
  rng: RNG,
  followers: number,
  socialScore: number,
  tags: readonly string[],
): Engagement {
  const engagementRate = 0.004 + (socialScore / 100) * 0.01
  const tagMultiplier = tags.reduce(
    (max, tag) => Math.max(max, TAG_ENGAGEMENT_MULTIPLIER[tag] ?? 1),
    1,
  )
  const noise = 0.75 + rng() * 0.5 // 0.75..1.25
  const likes = Math.max(0, Math.round(followers * engagementRate * tagMultiplier * noise))
  const repostRatio = 0.06 + rng() * 0.06 // 6%..12%
  const reposts = Math.max(0, Math.round(likes * repostRatio))
  return { likes, reposts }
}

export function followerDeltaFromEngagement(engagement: Engagement): number {
  return Math.round(engagement.likes * 0.002 + engagement.reposts * 0.01)
}

// How many NPC comments a post's reaction should schedule. Spec section 4.4:
// "schedules 5-15 comments ... with staggered timestamps".
export function commentCountForPost(rng: RNG, socialScore: number): number {
  const bonus = Math.round((socialScore / 100) * 4)
  return Math.min(15, randomInt(rng, 5, 11) + bonus)
}

// Stat deltas per canonical tag — summed across whatever tags the keyword
// tagger actually found in the caption. A plain post with no detected tags
// still gets a small baseline for the act of posting. Everything here only
// ever touches humor, aura, and (for the tags that should cost you an
// audience) followers directly — see PROJECT_SPEC.md section 17.5.
const BASE_DELTAS_BY_TAG: Record<string, Effect[]> = {
  big_moment: [{ type: 'stat', target: 'aura', delta: 3 }],
  huge_moment: [{ type: 'stat', target: 'aura', delta: 5 }],
  win: [{ type: 'stat', target: 'aura', delta: 2 }],
  loss: [{ type: 'stat', target: 'aura', delta: -2 }],
  rivalry: [
    { type: 'stat', target: 'aura', delta: 2 },
    { type: 'stat', target: 'humor', delta: 1 },
  ],
  controversial: [
    { type: 'stat', target: 'humor', delta: 3 },
    { type: 'stat', target: 'aura', delta: -3 },
    { type: 'followers', delta: -2 },
  ],
  setback: [
    { type: 'stat', target: 'aura', delta: -3 },
    { type: 'followers', delta: -1 },
  ],
  rumor: [{ type: 'stat', target: 'humor', delta: 2 }],
  deal: [{ type: 'stat', target: 'aura', delta: 3 }],
  criticism: [
    { type: 'stat', target: 'aura', delta: -2 },
    { type: 'followers', delta: -1 },
  ],
  party: [
    { type: 'stat', target: 'humor', delta: 3 },
    { type: 'stat', target: 'aura', delta: 1 },
  ],
  relationship: [{ type: 'stat', target: 'aura', delta: 2 }],
  apology: [{ type: 'stat', target: 'aura', delta: 1 }],
  gratitude: [
    { type: 'stat', target: 'aura', delta: 2 },
    { type: 'stat', target: 'humor', delta: 1 },
  ],
  // Detected generically (see engine/funMarkers.ts), not career-specific.
  funny: [{ type: 'stat', target: 'humor', delta: 4 }],
  aura_moment: [{ type: 'stat', target: 'aura', delta: 4 }],
}

const DEFAULT_POST_DELTAS: Effect[] = [{ type: 'stat', target: 'humor', delta: 1 }]

// Small ±1 noise per delta so identical tags don't feel robotic, still
// fully deterministic given the same rng sequence.
export function statDeltasForTags(rng: RNG, tags: readonly string[]): Effect[] {
  const matched = tags.flatMap((tag) => BASE_DELTAS_BY_TAG[tag] ?? [])
  const base = matched.length > 0 ? matched : DEFAULT_POST_DELTAS
  return base.map((effect) => ({
    ...effect,
    delta: effect.delta + randomInt(rng, -1, 1),
  }))
}
