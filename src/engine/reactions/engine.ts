import type { Effect, GameEvent, NPC, Persona } from '../../types'
import type { RNG } from '../rng'
import { pick, pickWeighted, randomInt } from '../rng'
import { makeId } from '../id'
import { fillTemplate } from '../templates/filler'
import { pushRecentLine, selectLine } from '../templates/select'
import { applyPersonalityVoice } from '../voice'
import type { ReactionPool } from '../../content/careers/types'
import {
  COMMENT_DELAY_RANGE_MS,
  eligiblePersonasForTags,
} from './rules'
import { commentCountForPost, estimateEngagement, followerDeltaFromEngagement, statDeltasForTags } from '../formulas'
import type { Engagement } from '../formulas'

export interface CommentPayload {
  parentPostId: string
  npcId: string
  text: string
  tags: string[]
  // Marks this comment as one the AI path may replace with a live-generated
  // line grounded in the post's actual text (and, sometimes, recent gossip)
  // — see src/ai/commentService.ts. Every comment gets this now (both the
  // broad crowd below and the social circle further down), so replies
  // actually react to what was posted instead of reading as generic canned
  // lines. The deterministic `text` above is always computed regardless, as
  // the fallback when AI is off, unconfigured, over budget, or fails.
  aiEligible?: boolean
  // If set, once this comment lands, schedule exactly one AI-eligible
  // reply to it from this other social-circle NPC — one level deep only,
  // never chained further. See runSocialCircleEngine.
  replyFromNpcId?: string
}

export interface ScheduledCommentItem {
  id: string
  dueAt: number
  kind: 'comment'
  payload: CommentPayload
}

export interface ReactionOutcome {
  scheduledItems: ScheduledCommentItem[]
  statDeltas: Effect[]
  engagement: Engagement
  followerDelta: number
  // Final recentLineIds ring buffer per NPC that received a scheduled line,
  // to be written back onto the NPC record by the caller.
  npcLineUpdates: Record<string, string[]>
}

export interface ReactionEngineArgs {
  event: GameEvent
  postId: string
  npcs: readonly NPC[]
  reactionPool: Record<Persona, ReactionPool>
  orgName: string
  playerDisplayName: string
  playerFollowers: number
  playerFame: number
  rng: RNG
  now: number
}

// Relationship (-100..100) skews who's likely to jump into the replies —
// never gates it to zero, so a hater can still show up.
function relationshipWeight(npc: NPC): number {
  return Math.max(1, npc.relationship + 60)
}

export function runReactionEngine(args: ReactionEngineArgs): ReactionOutcome {
  const { event, postId, npcs, reactionPool, orgName, playerDisplayName, playerFollowers, playerFame, rng, now } =
    args

  const eligiblePersonas = new Set(eligiblePersonasForTags(event.tags))
  const candidates = npcs.filter((n) => eligiblePersonas.has(n.persona))
  const pool = candidates.length > 0 ? candidates : npcs

  const commentCount = pool.length > 0 ? commentCountForPost(rng, playerFame) : 0

  const scheduledItems: ScheduledCommentItem[] = []
  const npcLineUpdates: Record<string, string[]> = {}

  for (let i = 0; i < commentCount && pool.length > 0; i++) {
    const npc = pickWeighted(rng, pool, relationshipWeight)
    const recentLineIds = npcLineUpdates[npc.id] ?? npc.recentLineIds
    const linePool = reactionPool[npc.persona]
    const selection = selectLine(rng, linePool, event.tags, recentLineIds)
    npcLineUpdates[npc.id] = pushRecentLine(recentLineIds, selection.lineId)

    const filled = fillTemplate(selection.line, { player: playerDisplayName, org: orgName })
    const text = applyPersonalityVoice(filled, npc, rng)
    const dueAt = now + randomInt(rng, COMMENT_DELAY_RANGE_MS[0], COMMENT_DELAY_RANGE_MS[1])

    scheduledItems.push({
      id: makeId('sched'),
      dueAt,
      kind: 'comment',
      payload: { parentPostId: postId, npcId: npc.id, text, tags: event.tags, aiEligible: true },
    })
  }

  scheduledItems.sort((a, b) => a.dueAt - b.dueAt)

  const engagement = estimateEngagement(rng, playerFollowers, playerFame, event.tags)
  const followerDelta = followerDeltaFromEngagement(engagement)
  const statDeltas: Effect[] = [
    ...statDeltasForTags(rng, event.tags),
    { type: 'followers', delta: followerDelta },
  ]

  return { scheduledItems, statDeltas, engagement, followerDelta, npcLineUpdates }
}

// At most this many followed NPCs get a guaranteed comment slot per post —
// caps AI cost predictably regardless of how many people the player follows.
export const SOCIAL_CIRCLE_MAX = 6
// Chance a single NOT-yet-followed NPC also jumps into the replies anyway —
// "the odd celebrity who notices you before you follow them."
export const ODD_CELEBRITY_CHANCE = 0.15
// At most this many circle comments get a single one-level-deep AI reply
// from a *different* circle member — never chained further than that.
const MAX_CROSS_REPLIES = 2

export interface SocialCircleArgs {
  event: GameEvent
  postId: string
  circleNpcs: readonly NPC[] // already capped by the caller (followedByPlayer, up to SOCIAL_CIRCLE_MAX)
  oddCelebrity: NPC | null // an extra non-circle NPC that comments anyway, or null
  reactionPool: Record<Persona, ReactionPool>
  orgName: string
  playerDisplayName: string
  rng: RNG
  now: number
}

export interface SocialCircleOutcome {
  scheduledItems: ScheduledCommentItem[]
  npcLineUpdates: Record<string, string[]>
}

// The player's social circle — who they follow, plus maybe one surprise
// non-follower — gets a guaranteed comment on every post (unlike the random
// weighted draw above), each eligible for a live AI reply, with up to two
// of them getting a single AI-eligible reply from another circle member.
// See PROJECT_SPEC.md section 8 for the "gameplay never blocks on AI" rule
// this still has to honor: every line here has a deterministic fallback.
export function runSocialCircleEngine(args: SocialCircleArgs): SocialCircleOutcome {
  const { event, postId, circleNpcs, oddCelebrity, reactionPool, orgName, playerDisplayName, rng, now } = args
  const commenters = oddCelebrity ? [...circleNpcs, oddCelebrity] : circleNpcs
  if (commenters.length === 0) return { scheduledItems: [], npcLineUpdates: {} }

  const scheduledItems: ScheduledCommentItem[] = []
  const npcLineUpdates: Record<string, string[]> = {}

  for (const npc of commenters) {
    const recentLineIds = npcLineUpdates[npc.id] ?? npc.recentLineIds
    const linePool = reactionPool[npc.persona]
    const selection = selectLine(rng, linePool, event.tags, recentLineIds)
    npcLineUpdates[npc.id] = pushRecentLine(recentLineIds, selection.lineId)

    const filled = fillTemplate(selection.line, { player: playerDisplayName, org: orgName })
    const text = applyPersonalityVoice(filled, npc, rng)
    const dueAt = now + randomInt(rng, COMMENT_DELAY_RANGE_MS[0], COMMENT_DELAY_RANGE_MS[1])

    scheduledItems.push({
      id: makeId('sched'),
      dueAt,
      kind: 'comment',
      payload: { parentPostId: postId, npcId: npc.id, text, tags: event.tags, aiEligible: true },
    })
  }

  scheduledItems.sort((a, b) => a.dueAt - b.dueAt)

  // Cross-replies only happen between people the player actually follows —
  // an odd celebrity who showed up uninvited doesn't get roped into banter.
  if (circleNpcs.length >= 2) {
    const crossReplyCount = Math.min(MAX_CROSS_REPLIES, Math.floor(circleNpcs.length / 2))
    const circleItems = scheduledItems.filter((item) => circleNpcs.some((n) => n.id === item.payload.npcId))
    const chosen = new Set<number>()
    while (chosen.size < crossReplyCount && chosen.size < circleItems.length) {
      chosen.add(Math.floor(rng() * circleItems.length))
    }
    for (const idx of chosen) {
      const target = circleItems[idx]
      const repliers = circleNpcs.filter((n) => n.id !== target.payload.npcId)
      if (repliers.length === 0) continue
      target.payload.replyFromNpcId = pick(rng, repliers).id
    }
  }

  return { scheduledItems, npcLineUpdates }
}
