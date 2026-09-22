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
