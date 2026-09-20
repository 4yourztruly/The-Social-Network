import type { Persona } from '../../types'

// Which NPC personas are plausible commenters for a given tag. The union
// across all of an event's tags becomes the eligible pool; falls back to
// DEFAULT_ELIGIBLE_PERSONAS when no tag matches. See PROJECT_SPEC.md
// section 5 "Reaction rules are data".
// Tag names are canonical across every career pack (see
// src/content/careers) — "big_moment" covers a goal, a platinum single, or
// a home run alike. Only the keyword rules that produce these tags, and the
// line content that reacts to them, vary per career.
export const ELIGIBLE_PERSONAS_BY_TAG: Partial<Record<string, Persona[]>> = {
  big_moment: ['loyal_fan', 'teammate', 'meme_account', 'match_reporter'],
  huge_moment: ['loyal_fan', 'teammate', 'meme_account', 'match_reporter', 'coach'],
  win: ['loyal_fan', 'teammate', 'meme_account'],
  loss: ['hater', 'loyal_fan', 'rival', 'meme_account'],
  rivalry: ['rival', 'loyal_fan', 'meme_account'],
  controversial: ['hater', 'tabloid', 'rival', 'loyal_fan', 'meme_account'],
  party: ['tabloid', 'meme_account', 'loyal_fan'],
  setback: ['loyal_fan', 'teammate', 'match_reporter'],
  rumor: ['insider', 'loyal_fan', 'hater'],
  deal: ['insider', 'agent', 'loyal_fan'],
  criticism: ['hater', 'loyal_fan', 'meme_account'],
  relationship: ['tabloid', 'loyal_fan', 'meme_account'],
  apology: ['loyal_fan', 'hater', 'meme_account'],
  gratitude: ['loyal_fan', 'teammate'],
}

export const DEFAULT_ELIGIBLE_PERSONAS: Persona[] = ['loyal_fan', 'meme_account']

export function eligiblePersonasForTags(tags: readonly string[]): Persona[] {
  const set = new Set<Persona>()
  for (const tag of tags) {
    for (const persona of ELIGIBLE_PERSONAS_BY_TAG[tag] ?? []) set.add(persona)
  }
  if (set.size === 0) for (const persona of DEFAULT_ELIGIBLE_PERSONAS) set.add(persona)
  return [...set]
}

// Comments land near-instantly — this is for posts, where the payoff is
// seeing reactions pour in right away. DMs keep a longer delay for the
// "typing" effect instead; see DM_REPLY_DELAY_RANGE_MS.
export const COMMENT_DELAY_RANGE_MS: [number, number] = [300, 1_500]
