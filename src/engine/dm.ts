import type { NPC, Persona } from '../types'
import type { RNG } from './rng'
import { randomInt } from './rng'
import { pushRecentLine, selectLine } from './templates/select'
import { fillTemplate } from './templates/filler'
import { applyPersonalityVoice } from './voice'
import type { ReactionPool } from '../content/careers/types'
import { GENERIC_OFFTOPIC_REACTION_POOL } from '../content/genericFiller'

// DMs keep a deliberate "typing" delay for effect, unlike post comments
// which now land near-instantly. Spec section 4.6: "typing indicator
// (~1-3s)".
export const DM_REPLY_DELAY_RANGE_MS: [number, number] = [2000, 3000]

export interface DMSchedulePayload {
  npcId: string
  text: string
}

export interface DMReplyResult {
  text: string
  dueAt: number
  recentLineIds: string[]
}

// DM replies aren't tag-gated (no post tags in a chat) — draw from the
// persona's generic voice, sharing the same anti-repetition ring buffer
// used for public comments so an NPC doesn't repeat itself across surfaces.
export function generateDmReply(args: {
  npc: NPC
  reactionPool: Record<Persona, ReactionPool>
  playerDisplayName: string
  orgName: string
  rng: RNG
  now: number
}): DMReplyResult {
  const { npc, reactionPool, playerDisplayName, orgName, rng, now } = args
  const pool = npc.offTopic ? GENERIC_OFFTOPIC_REACTION_POOL : reactionPool[npc.persona]
  const selection = selectLine(rng, pool, [], npc.recentLineIds)
  const dueAt = now + randomInt(rng, DM_REPLY_DELAY_RANGE_MS[0], DM_REPLY_DELAY_RANGE_MS[1])
  const filled = fillTemplate(selection.line, { player: playerDisplayName, org: orgName })
  return {
    text: applyPersonalityVoice(filled, npc, rng),
    dueAt,
    recentLineIds: pushRecentLine(npc.recentLineIds, selection.lineId),
  }
}

// A celeb reaching out first, unprompted — friendly openers that don't
// assume anything about the player's career, so they fit any celebrity.
const OUTREACH_LINES = [
  'Hey {player}! Been thinking about you — how are you doing?',
  'Saw your latest post and had to reach out 😊 what are you up to?',
  'Random one, but I really enjoy talking to you. Free to catch up soon?',
  'Hey you. Just checking in — how has your week been?',
  '{player}!! I was literally about to message you. What are you up to today?',
  'Hope your week is going well {player}. Wanted to say hi!',
]

export function openingDmText(rng: RNG, npc: NPC, playerDisplayName: string): string {
  const line = OUTREACH_LINES[Math.floor(rng() * OUTREACH_LINES.length)]
  return applyPersonalityVoice(fillTemplate(line, { player: playerDisplayName, org: '' }), npc, rng)
}
