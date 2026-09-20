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
}

export interface Engagement {
  likes: number
  reposts: number
}

export function estimateEngagement(
  rng: RNG,
  followers: number,
  fame: number,
  tags: readonly string[],
): Engagement {
  const engagementRate = 0.004 + (fame / 100) * 0.01
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
export function commentCountForPost(rng: RNG, fame: number): number {
  const bonus = Math.round((fame / 100) * 4)
  return Math.min(15, randomInt(rng, 5, 11) + bonus)
}

// Stat deltas per canonical tag — summed across whatever tags the keyword
// tagger actually found in the caption. A plain post with no detected tags
// still gets a small baseline for the act of posting.
const BASE_DELTAS_BY_TAG: Record<string, Effect[]> = {
  big_moment: [
    { type: 'fame', delta: 2 },
    { type: 'stat', target: 'hype', delta: 3 },
    { type: 'morale', delta: 2 },
  ],
  huge_moment: [
    { type: 'fame', delta: 3 },
    { type: 'stat', target: 'hype', delta: 4 },
    { type: 'morale', delta: 3 },
  ],
  win: [
    { type: 'fame', delta: 1 },
    { type: 'morale', delta: 1 },
  ],
  loss: [{ type: 'morale', delta: -2 }],
  rivalry: [
    { type: 'stat', target: 'hype', delta: 1 },
    { type: 'stat', target: 'controversy', delta: 1 },
  ],
  controversial: [
    { type: 'stat', target: 'hype', delta: 4 },
    { type: 'stat', target: 'reputation', delta: -3 },
    { type: 'stat', target: 'controversy', delta: 8 },
  ],
  setback: [{ type: 'morale', delta: -2 }],
  rumor: [{ type: 'stat', target: 'hype', delta: 1 }],
  deal: [
    { type: 'fame', delta: 1 },
    { type: 'stat', target: 'reputation', delta: 1 },
  ],
  criticism: [{ type: 'stat', target: 'reputation', delta: -1 }],
  party: [
    { type: 'stat', target: 'hype', delta: 2 },
    { type: 'stat', target: 'controversy', delta: 2 },
  ],
  relationship: [
    { type: 'stat', target: 'hype', delta: 1 },
    { type: 'stat', target: 'controversy', delta: 1 },
  ],
  apology: [
    { type: 'stat', target: 'reputation', delta: 2 },
    { type: 'stat', target: 'controversy', delta: -2 },
  ],
  gratitude: [
    { type: 'stat', target: 'reputation', delta: 3 },
    { type: 'morale', delta: 1 },
  ],
  // Detected generically (see engine/funMarkers.ts), not career-specific.
  funny: [{ type: 'stat', target: 'humor', delta: 4 }],
  aura_moment: [{ type: 'stat', target: 'aura', delta: 4 }],
}

const DEFAULT_POST_DELTAS: Effect[] = [{ type: 'morale', delta: 1 }]

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
