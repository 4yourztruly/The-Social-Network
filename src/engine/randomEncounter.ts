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

// Choice labels spell out exactly what the player does or says, not a
// terse verb phrase — so the player knows what they're actually picking.
const PROMPTS: EncounterPrompt[] = [
  {
    id: 'heckler',
    text: 'A heckler in the crowd yells something about you loud enough for everyone to hear.',
    choices: [
      { id: 'clap_back', label: 'Turn straight to them and fire back a sharp one-liner', risk: 'bold' },
      { id: 'laugh_it_off', label: 'Laugh it off and wave, refusing to let it land', risk: 'safe' },
      { id: 'ignore', label: 'Keep walking like you never heard a thing', risk: 'safe' },
    ],
  },
  {
    id: 'photographer',
    text: 'A photographer catches you off guard leaving a late-night spot.',
    choices: [
      { id: 'smile', label: 'Stop, smile, and give them a clean shot', risk: 'safe' },
      { id: 'cover_face', label: 'Cover your face with your jacket and rush to the car', risk: 'bold' },
      { id: 'joke', label: 'Strike a ridiculous pose and turn it into a joke', risk: 'bold' },
    ],
  },
  {
    id: 'interview_trap',
    text: 'A reporter asks you a loaded question, live, with cameras rolling.',
    choices: [
      { id: 'honest', label: 'Answer completely honestly, even knowing it could blow up', risk: 'bold' },
      { id: 'deflect', label: 'Deflect with a vague, safe non-answer', risk: 'safe' },
      { id: 'no_comment', label: 'Say "no comment" and end the interview there', risk: 'safe' },
    ],
  },
  {
    id: 'fan_moment',
    text: 'A young fan works up the courage to approach you in public.',
    choices: [
      { id: 'make_their_day', label: 'Stop everything, kneel down, and really talk to them', risk: 'safe' },
      { id: 'quick_photo', label: 'Take a quick, friendly photo and keep moving', risk: 'safe' },
      { id: 'brush_past', label: "Brush right past them like they're not there", risk: 'bold' },
    ],
  },
  {
    id: 'awkward_run_in',
    text: 'You run into {celeb} at an event and the conversation turns awkward fast.',
    requiresCeleb: true,
    choices: [
      { id: 'own_it', label: 'Call out the awkwardness out loud and laugh about it together', risk: 'bold' },
      { id: 'smooth_over', label: 'Smoothly change the subject and keep things light', risk: 'safe' },
      { id: 'walk_away', label: 'Cut the conversation short and walk away', risk: 'bold' },
    ],
  },
  {
    id: 'celeb_dare',
    text: '{celeb} dares you to do something ridiculous in front of everyone.',
    requiresCeleb: true,
    choices: [
      { id: 'do_it', label: 'Go all in and actually do the dare', risk: 'bold' },
      { id: 'laugh_no', label: 'Laugh, shake your head, and turn it down', risk: 'safe' },
      { id: 'one_up', label: 'Top the dare with something even bolder of your own', risk: 'bold' },
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
