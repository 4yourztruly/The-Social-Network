import type { Effect } from '../types'

// The expanded "report card": why each thing moved and where relationships
// stand now, not just the headline numbers. Everything here is derived from
// what was actually detected/rolled — no invented reasons.

export interface StatReason {
  stat: 'humor' | 'aura' | 'followers'
  delta: number
  reason: string
}

export interface RelationshipDetail {
  npcId: string
  delta: number
  before: number
  after: number
  reason: string
}

export interface OutcomeDetails {
  // One short paragraph on what actually happened.
  summary: string
  statReasons: StatReason[]
  relationships: RelationshipDetail[]
  // Signals detected (tags) — e.g. "big moment", "party".
  signals: string[]
  // What the tabloids/comments did with it.
  buzz?: string
}

const TAG_PHRASES: Record<string, string> = {
  big_moment: 'a big moment',
  huge_moment: 'a huge moment',
  win: 'a win',
  loss: 'a loss',
  rivalry: 'rivalry banter',
  controversial: 'controversial',
  setback: 'a setback',
  rumor: 'a rumor',
  deal: 'a deal',
  criticism: 'criticism',
  party: 'a night out',
  relationship: 'relationship news',
  apology: 'an apology',
  gratitude: 'gratitude',
  funny: 'funny',
  aura_moment: 'an iconic moment',
  scandal_leak: 'a scandal',
}

// Which stats each tag pushes, mirroring formulas.ts BASE_DELTAS_BY_TAG
// (direction only — the actual numbers come from the roll).
const TAG_STATS: Record<string, ('humor' | 'aura' | 'followers')[]> = {
  big_moment: ['aura'],
  huge_moment: ['aura'],
  win: ['aura'],
  loss: ['aura'],
  rivalry: ['aura', 'humor'],
  controversial: ['humor', 'aura', 'followers'],
  setback: ['aura', 'followers'],
  rumor: ['humor'],
  deal: ['aura'],
  criticism: ['aura', 'followers'],
  party: ['humor', 'aura'],
  relationship: ['aura'],
  apology: ['aura'],
  gratitude: ['aura', 'humor'],
  funny: ['humor'],
  aura_moment: ['aura'],
}

export function tagPhrase(tag: string): string {
  return TAG_PHRASES[tag] ?? tag.replace(/_/g, ' ')
}

function listPhrases(tags: readonly string[]): string {
  const phrases = tags.map(tagPhrase)
  if (phrases.length <= 1) return phrases[0] ?? ''
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`
}

const STAT_LABEL = { humor: 'Humor', aura: 'Aura', followers: 'Followers' } as const

export type ReportSubject = 'post' | 'activity' | 'event' | 'reply' | 'story' | 'chat'

// Why humor/aura moved: the detected signals that push that stat, or the
// small baseline when nothing stood out. Followers get their own reason
// text from the caller (it depends on engagement or the outcome tier).
export function explainStatDeltas(
  tags: readonly string[],
  effects: readonly Effect[],
  subject: ReportSubject,
  followerReason?: string,
  followerDelta = 0,
  eventOutcome?: { tier: 'good' | 'neutral' | 'bad' },
): StatReason[] {
  const totals: Record<'humor' | 'aura', number> = { humor: 0, aura: 0 }
  for (const e of effects) {
    if (e.type === 'stat' && (e.target === 'humor' || e.target === 'aura')) totals[e.target] += e.delta
  }
  const reasons: StatReason[] = []
  for (const stat of ['aura', 'humor'] as const) {
    if (totals[stat] === 0) continue
    let reason: string
    if (subject === 'event' && eventOutcome) {
      reason =
        eventOutcome.tier === 'good'
          ? `You handled it well, and people noticed your ${stat === 'aura' ? 'presence' : 'wit'}.`
          : eventOutcome.tier === 'bad'
            ? 'It went badly — the moment hurt how people see you.'
            : ''
    } else {
      const drivers = tags.filter((t) => TAG_STATS[t]?.includes(stat))
      reason =
        drivers.length > 0
          ? `Your ${subject} came across as ${listPhrases(drivers)}.`
          : `A plain ${subject} with no strong signal — just the small baseline for putting yourself out there.`
    }
    reasons.push({ stat, delta: totals[stat], reason })
  }
  if (followerDelta !== 0) {
    reasons.push({ stat: 'followers', delta: followerDelta, reason: followerReason ?? 'Your audience shifted.' })
  }
  return reasons
}

export function statLabel(stat: StatReason['stat']): string {
  return STAT_LABEL[stat]
}

// How a relationship value (-100..100) reads as words.
export function relationshipLabel(value: number): string {
  if (value <= -60) return 'Enemies'
  if (value <= -25) return 'Tense'
  if (value < 10) return 'Neutral'
  if (value < 35) return 'Friendly'
  if (value < 65) return 'Close'
  return 'Inseparable'
}
