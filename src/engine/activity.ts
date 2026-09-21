import type { NPC, Persona } from '../types'
import type { RNG } from './rng'
import { pick } from './rng'
import { applyPersonalityVoice } from './voice'

// Deterministic fallback content for the Activity scene — used whenever AI
// is off, unconfigured, over budget, or fails (spec section 8, robustness
// rule 1: "gameplay never blocks on AI"). AI narration (activityService.ts)
// is the richer, opt-in path; this keeps the feature fully playable without it.

// Always-available fallback choices — used whenever AI is off, unconfigured,
// over budget, or fails to return usable scene-specific options. Deliberately
// generic (not tied to the scene) since they have to work for any activity.
export const ACTIVITY_CHOICES = [
  'Lean into being charming and see how they respond',
  'Be completely honest about how you feel right now',
  'Stay relaxed and play it cool',
  'Make a bold, unexpected move',
] as const

type ChoiceCategory = 'charming' | 'honest' | 'cool' | 'bold' | 'default'

const CHOICE_FALLBACK_LINES: Record<ChoiceCategory, string[]> = {
  charming: ["{name} can't help but smile at that.", "That easy charm doesn't go unnoticed."],
  honest: ['{name} seems to appreciate the honesty.', 'That lands better than expected.'],
  cool: ['The vibe stays relaxed.', '{name} matches the energy.'],
  bold: ['That bold move changes the energy in the room.', '{name} raises an eyebrow, intrigued.'],
  default: ['The moment continues.', '{name} takes that in.'],
}

function categorize(text: string): ChoiceCategory {
  const t = text.toLowerCase()
  if (t.includes('charming')) return 'charming'
  if (t.includes('honest')) return 'honest'
  if (t.includes('cool')) return 'cool'
  if (t.includes('bold')) return 'bold'
  return 'default'
}

export function templatedActivityBeat(rng: RNG, playerChoiceText: string, participants: readonly NPC[]): string {
  const line = pick(rng, CHOICE_FALLBACK_LINES[categorize(playerChoiceText)])
  const primary = participants[0]
  const filled = line.replace('{name}', primary?.displayName ?? 'They')
  return primary ? applyPersonalityVoice(filled, primary, rng) : filled
}

export function templatedActivityOpening(description: string, participants: readonly NPC[]): string {
  if (participants.length === 0) return description
  const names = participants.map((p) => p.displayName).join(' and ')
  const verb = participants.length > 1 ? 'are' : 'is'
  return `${names} ${verb} here. ${description}`
}

// Only these tags make an activity newsworthy at all — a routine training
// session never gets covered, regardless of how the roll would otherwise go.
export const MEDIA_COVERAGE_TAGS = ['party', 'relationship', 'controversial', 'rumor', 'scandal_leak']
const MEDIA_PERSONAS: Persona[] = ['tabloid', 'insider', 'match_reporter']

export function pickMediaOutlet(npcs: readonly NPC[]): NPC | null {
  for (const persona of MEDIA_PERSONAS) {
    const found = npcs.find((n) => n.persona === persona)
    if (found) return found
  }
  return null
}

export type RsvpDecision = 'accepted' | 'declined'

// Relationship (-100..100) is the dominant factor in whether an invited NPC
// actually shows up; a few personality traits nudge it further. Never fully
// certain either way — even a close friend can flake, even a rival might
// show just to see what happens.
const RSVP_POSITIVE_TRAITS = ['loyal', 'passionate', 'optimistic', 'mentor', 'discreet', 'confident', 'thorough']
const RSVP_NEGATIVE_TRAITS = ['blunt', 'contrarian', 'cocky', 'sarcastic', 'irreverent']

export function computeRsvp(npc: NPC, rng: RNG): RsvpDecision {
  let chance = 0.5 + npc.relationship / 200 // -100..100 -> -0.5..+0.5
  for (const trait of npc.personality) {
    if (RSVP_POSITIVE_TRAITS.includes(trait)) chance += 0.08
    if (RSVP_NEGATIVE_TRAITS.includes(trait)) chance -= 0.08
  }
  chance = Math.min(0.95, Math.max(0.05, chance))
  return rng() < chance ? 'accepted' : 'declined'
}

// 0 when nothing newsworthy happened; otherwise a base chance that climbs
// with how risky the activity was and how long it ran, capped well under
// certain so a leak is never guaranteed.
export function coverageChance(tags: readonly string[], turnCount: number): number {
  if (!tags.some((t) => MEDIA_COVERAGE_TAGS.includes(t))) return 0
  let chance = 0.3
  if (tags.includes('controversial') || tags.includes('scandal_leak')) chance += 0.2
  if (turnCount >= 3) chance += 0.15
  return Math.min(chance, 0.8)
}
