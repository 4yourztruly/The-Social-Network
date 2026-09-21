import type { Effect } from '../types'
import type { RNG } from './rng'
import { pick } from './rng'

// The "Event" button — a quick, spontaneous decision, unlike Activities
// (which are player-authored, multi-turn scenes). One prompt, one choice,
// one outcome, resolved instantly. The same choice can land well or badly —
// "bold" choices swing harder either way than "safe" ones.

export type EncounterRisk = 'safe' | 'bold'
export type EncounterTier = 'good' | 'neutral' | 'bad'

export interface EncounterChoice {
  id: string
  label: string
  risk: EncounterRisk
}

export interface EncounterPrompt {
  id: string
  text: string // may contain {celeb} — filled with a participant's name
  requiresCeleb?: boolean
  choices: EncounterChoice[]
}

const PROMPTS: EncounterPrompt[] = [
  {
    id: 'heckler',
    text: 'A heckler in the crowd yells something about you loud enough for everyone to hear.',
    choices: [
      { id: 'clap_back', label: 'Clap back', risk: 'bold' },
      { id: 'laugh_it_off', label: 'Laugh it off', risk: 'safe' },
      { id: 'ignore', label: 'Ignore them', risk: 'safe' },
    ],
  },
  {
    id: 'photographer',
    text: 'A photographer catches you off guard leaving a late-night spot.',
    choices: [
      { id: 'smile', label: 'Smile for the camera', risk: 'safe' },
      { id: 'cover_face', label: 'Cover your face and rush off', risk: 'bold' },
      { id: 'joke', label: 'Make a joke of it', risk: 'bold' },
    ],
  },
  {
    id: 'interview_trap',
    text: 'A reporter asks you a loaded question, live, with cameras rolling.',
    choices: [
      { id: 'honest', label: 'Answer honestly', risk: 'bold' },
      { id: 'deflect', label: 'Deflect the question', risk: 'safe' },
      { id: 'no_comment', label: '"No comment."', risk: 'safe' },
    ],
  },
  {
    id: 'fan_moment',
    text: 'A young fan works up the courage to approach you in public.',
    choices: [
      { id: 'make_their_day', label: "Make their day", risk: 'safe' },
      { id: 'quick_photo', label: 'Quick photo and go', risk: 'safe' },
      { id: 'brush_past', label: 'Brush right past them', risk: 'bold' },
    ],
  },
  {
    id: 'awkward_run_in',
    text: 'You run into {celeb} at an event and the conversation turns awkward fast.',
    requiresCeleb: true,
    choices: [
      { id: 'own_it', label: 'Own the awkwardness', risk: 'bold' },
      { id: 'smooth_over', label: 'Smooth it over', risk: 'safe' },
      { id: 'walk_away', label: 'Walk away', risk: 'bold' },
    ],
  },
  {
    id: 'celeb_dare',
    text: '{celeb} dares you to do something ridiculous in front of everyone.',
    requiresCeleb: true,
    choices: [
      { id: 'do_it', label: 'Do it', risk: 'bold' },
      { id: 'laugh_no', label: "Laugh and say no", risk: 'safe' },
      { id: 'one_up', label: 'One-up them instead', risk: 'bold' },
    ],
  },
]

export function pickPrompt(rng: RNG, celebAvailable: boolean): EncounterPrompt {
  const pool = celebAvailable ? PROMPTS : PROMPTS.filter((p) => !p.requiresCeleb)
  return pick(rng, pool)
}

const OUTCOME_TEXT: Record<EncounterTier, string[]> = {
  good: [
    'It lands perfectly — people are loving it.',
    "That's the moment everyone's talking about tonight.",
    'Clean. People are already screenshotting it.',
  ],
  neutral: [
    'It barely registers. Onto the next thing.',
    'A few people notice. Most scroll right past.',
  ],
  bad: [
    "That did NOT land the way you hoped.",
    "People are bringing this up in every comment section now.",
    "Yeah... that one's going to follow you around for a bit.",
  ],
}

export function outcomeText(rng: RNG, tier: EncounterTier): string {
  return pick(rng, OUTCOME_TEXT[tier])
}

// Bold choices swing harder both ways; safe choices mostly land fine.
export function rollTier(rng: RNG, risk: EncounterRisk): EncounterTier {
  const roll = rng()
  if (risk === 'bold') {
    if (roll < 0.4) return 'good'
    if (roll < 0.65) return 'neutral'
    return 'bad'
  }
  if (roll < 0.55) return 'good'
  if (roll < 0.9) return 'neutral'
  return 'bad'
}

export interface EncounterOutcome {
  statDeltas: Effect[]
  followerDelta: number
  tags: string[]
}

export function tierOutcome(tier: EncounterTier, followers: number): EncounterOutcome {
  const scale = Math.max(1, Math.round(followers / 5000))
  if (tier === 'good') {
    return {
      statDeltas: [
        { type: 'stat', target: 'aura', delta: 4 },
        { type: 'stat', target: 'humor', delta: 2 },
      ],
      followerDelta: 3 * scale,
      tags: [],
    }
  }
  if (tier === 'bad') {
    return {
      statDeltas: [{ type: 'stat', target: 'aura', delta: -5 }],
      followerDelta: -2 * scale,
      tags: ['controversial', 'rumor'],
    }
  }
  return { statDeltas: [], followerDelta: 0, tags: [] }
}
