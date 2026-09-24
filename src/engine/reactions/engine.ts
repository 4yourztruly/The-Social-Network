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
import { CROSS_MENTION_BANTER_LINES, PLAYER_MENTION_BANTER_LINES, fillBanterTarget } from '../banter'
import { GENERIC_OFFTOPIC_REACTION_POOL } from '../../content/genericFiller'
import { relatedComment } from '../specificContent'
import { reactionStance, stanceLine, type Stance } from '../interest'
import { tierForPersona } from '../npcTier'

// An offTopic NPC (a real celeb the AI picked for variety, unrelated to
// this career's world) never draws from this pack's sport/industry-flavored
// reaction lines — see content/genericFiller.ts.
function reactionPoolFor(reactionPool: Record<Persona, ReactionPool>, npc: NPC): ReactionPool {
  return npc.offTopic ? GENERIC_OFFTOPIC_REACTION_POOL : reactionPool[npc.persona]
}

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
  // Set on comments that are reacting to a tabloid/gossip story rather than
  // to the parent post's own text — the fact sheet of what actually
  // happened, so a comment on an unrelated post can still clearly refer to
  // it (see engine/gossip.ts).
  gossip?: string
  // How this person relates to what's being commented on (a rival, a fan, a
  // neutral) — tells the AI who they are in this moment. See engine/interest.ts.
  stance?: Stance
  // If set, once this comment lands, schedule exactly one AI-eligible
  // reply to it from this other social-circle NPC — one level deep only,
  // never chained further. See runSocialCircleEngine.
  replyFromNpcId?: string
  // Set on comments in a thread the player replied into: how many NPC hops
  // deep this one is. Each one may pull in one more participant, but the
  // chain is capped (see MAX_CHAIN_DEPTH in the store) so it can't loop.
  chainDepth?: number
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
  playerUsername: string
  // What the player actually wrote — lets some comments answer it directly.
  postText?: string
  playerFollowers: number
  playerSocialScore: number // (humor + aura) / 2 — see formulas.estimateEngagement
  rng: RNG
  now: number
}

// At least this many of a post's crowd comments literally @-mention someone
// — the player or another commenter in the same batch — instead of only
// referencing them by name in third person.
const MIN_MENTION_COMMENTS = 4

// Relationship (-100..100) skews who's likely to jump into the replies —
// never gates it to zero, so a hater can still show up.
function relationshipWeight(npc: NPC): number {
  return Math.max(1, npc.relationship + 60)
}

// Rewrites a handful of already-generated crowd comments into @-mention
// banter, in place — roughly half aimed at the player, half at another
// commenter earlier in the same batch (falls back to the player when
// there's no one else yet). Never touches more than MIN_MENTION_COMMENTS
// items, and skips entirely once the batch is too small to spare any.
function applyMentionBanter(items: ScheduledCommentItem[], npcs: NPC[], playerUsername: string, rng: RNG): void {
  if (items.length === 0) return

  const mentionCount = Math.min(MIN_MENTION_COMMENTS, items.length)
  const indices = [...items.keys()]
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const chosen = indices.slice(0, mentionCount)

  for (const idx of chosen) {
    const npc = npcs[idx]
    const otherIndices = indices.filter((i) => i !== idx)
    const targetPlayer = otherIndices.length === 0 || rng() < 0.5

    if (targetPlayer) {
      const line = pick(rng, PLAYER_MENTION_BANTER_LINES)
      items[idx].payload.text = applyPersonalityVoice(fillBanterTarget(line, playerUsername), npc, rng)
    } else {
      const targetNpc = npcs[pick(rng, otherIndices)]
      const line = pick(rng, CROSS_MENTION_BANTER_LINES)
      items[idx].payload.text = applyPersonalityVoice(fillBanterTarget(line, targetNpc.username), npc, rng)
    }
  }
}

export function runReactionEngine(args: ReactionEngineArgs): ReactionOutcome {
  const {
    event,
    postId,
    npcs,
    reactionPool,
    orgName,
    playerDisplayName,
    playerUsername,
    postText,
    playerFollowers,
    playerSocialScore,
    rng,
    now,
  } = args

  const eligiblePersonas = new Set(eligiblePersonasForTags(event.tags))
  const candidates = npcs.filter((n) => eligiblePersonas.has(n.persona))
  let pool = candidates.length > 0 ? candidates : npcs

  // Only people who'd actually react to THIS post: a Barcelona player doesn't
  // chant "Hala Madrid", someone who doesn't follow football scrolls past.
  const stanceOf = new Map<string, Stance>()
  if (postText) {
    for (const n of pool) stanceOf.set(n.id, reactionStance(n, postText))
    const interested = pool.filter((n) => stanceOf.get(n.id) !== 'skip')
    pool = interested.length >= 3 ? interested : npcs.filter((n) => tierForPersona(n.persona) === 'commenter')
  }

  const commentCount = pool.length > 0 ? commentCountForPost(rng, playerSocialScore) : 0

  const scheduledItems: ScheduledCommentItem[] = []
  const commenterNpcs: NPC[] = []
  const npcLineUpdates: Record<string, string[]> = {}

  for (let i = 0; i < commentCount && pool.length > 0; i++) {
    const npc = pickWeighted(rng, pool, relationshipWeight)
    const recentLineIds = npcLineUpdates[npc.id] ?? npc.recentLineIds
    const linePool = reactionPoolFor(reactionPool, npc)
    const selection = selectLine(rng, linePool, event.tags, recentLineIds)
    npcLineUpdates[npc.id] = pushRecentLine(recentLineIds, selection.lineId)

    const filled = fillTemplate(selection.line, { player: playerDisplayName, org: orgName })
    let text = applyPersonalityVoice(filled, npc, rng)
    const stance = stanceOf.get(npc.id)
    const stanced = postText && stance ? stanceLine(rng, stance, npc, postText) : null
    if (stanced) {
      text = applyPersonalityVoice(stanced, npc, rng)
    } else if (postText && rng() < 0.45) {
      const related = relatedComment(rng, postText, playerDisplayName, npc.persona)
      if (related) text = applyPersonalityVoice(related, npc, rng)
    }
    const dueAt = now + randomInt(rng, COMMENT_DELAY_RANGE_MS[0], COMMENT_DELAY_RANGE_MS[1])

    scheduledItems.push({
      id: makeId('sched'),
      dueAt,
      kind: 'comment',
      payload: { parentPostId: postId, npcId: npc.id, text, tags: event.tags, aiEligible: true, stance },
    })
    commenterNpcs.push(npc)
  }

  // Guarantees at least a few of these comments literally @-mention
  // someone — the player, or another commenter in the same batch — rather
  // than only ever name-dropping them in third person.
  applyMentionBanter(scheduledItems, commenterNpcs, playerUsername, rng)

  scheduledItems.sort((a, b) => a.dueAt - b.dueAt)

  const engagement = estimateEngagement(rng, playerFollowers, playerSocialScore, event.tags)
  const engagementFollowerDelta = followerDeltaFromEngagement(engagement)
  const tagEffects = statDeltasForTags(rng, event.tags)
  const tagFollowerDelta = tagEffects
    .filter((e) => e.type === 'followers')
    .reduce((sum, e) => sum + e.delta, 0)
  const followerDelta = engagementFollowerDelta + tagFollowerDelta
  const statDeltas: Effect[] = [
    ...tagEffects.filter((e) => e.type !== 'followers'),
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
  postText?: string
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
  const { event, postId, circleNpcs, oddCelebrity, reactionPool, orgName, playerDisplayName, postText, rng, now } = args
  const everyone = oddCelebrity ? [...circleNpcs, oddCelebrity] : circleNpcs
  // Being in the player's circle doesn't mean caring about every post.
  const circleStance = new Map<string, Stance>()
  if (postText) for (const n of everyone) circleStance.set(n.id, reactionStance(n, postText))
  const commenters = postText ? everyone.filter((n) => circleStance.get(n.id) !== 'skip') : everyone
  if (commenters.length === 0) return { scheduledItems: [], npcLineUpdates: {} }

  const scheduledItems: ScheduledCommentItem[] = []
  const npcLineUpdates: Record<string, string[]> = {}

  for (const npc of commenters) {
    const recentLineIds = npcLineUpdates[npc.id] ?? npc.recentLineIds
    const linePool = reactionPoolFor(reactionPool, npc)
    const selection = selectLine(rng, linePool, event.tags, recentLineIds)
    npcLineUpdates[npc.id] = pushRecentLine(recentLineIds, selection.lineId)

    const filled = fillTemplate(selection.line, { player: playerDisplayName, org: orgName })
    const stance = circleStance.get(npc.id)
    const stanced = postText && stance ? stanceLine(rng, stance, npc, postText) : null
    const text = applyPersonalityVoice(stanced ?? filled, npc, rng)
    const dueAt = now + randomInt(rng, COMMENT_DELAY_RANGE_MS[0], COMMENT_DELAY_RANGE_MS[1])

    scheduledItems.push({
      id: makeId('sched'),
      dueAt,
      kind: 'comment',
      payload: { parentPostId: postId, npcId: npc.id, text, tags: event.tags, aiEligible: true, stance },
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
