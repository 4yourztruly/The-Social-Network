import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../rng'
import { createGameEvent } from '../events'
import { runReactionEngine, runSocialCircleEngine } from './engine'
import { footballerPack } from '../../content/careers/footballer'
import type { NPC } from '../../types'

function makeNpc(overrides: Partial<NPC>): NPC {
  return {
    id: 'npc_1',
    username: 'npc1',
    displayName: 'NPC One',
    bio: '',
    avatar: { kind: 'initials', value: 'N1' },
    verified: false,
    followers: 1000,
    following: 10,
    joinedAt: 0,
    isPlayer: false,
    persona: 'loyal_fan',
    personality: [],
    relationship: 30,
    vibe: 'fan',
    mood: 0,
    postingStyle: { emoji: 0.5, caps: 0.2, hashtags: 0.2 },
    recentLineIds: [],
    followedByPlayer: false,
    ...overrides,
  }
}

const npcs: NPC[] = [
  makeNpc({ id: 'npc_fan', persona: 'loyal_fan', relationship: 50 }),
  makeNpc({ id: 'npc_teammate', persona: 'teammate', relationship: 40 }),
  makeNpc({ id: 'npc_hater', persona: 'hater', relationship: -40 }),
  makeNpc({ id: 'npc_rival', persona: 'rival', relationship: -30 }),
  makeNpc({ id: 'npc_reporter', persona: 'match_reporter', relationship: 0 }),
]

const baseArgs = {
  reactionPool: footballerPack.reactionPool,
  orgName: footballerPack.worldName,
  playerDisplayName: 'Alex Rennick',
  playerUsername: 'alexrennick',
  playerFollowers: 100_000,
  playerSocialScore: 60,
  now: 1000,
}

describe('runReactionEngine', () => {
  it('is deterministic for a given seed', () => {
    const event = createGameEvent({ type: 'player_post', tags: ['big_moment'], timestamp: 1000 })
    const args = { ...baseArgs, event, postId: 'post_1', npcs }
    const a = runReactionEngine({ ...args, rng: mulberry32(123) })
    const b = runReactionEngine({ ...args, rng: mulberry32(123) })
    // Item ids are globally unique (crypto.randomUUID), not seeded — compare
    // everything else, which should be identical given the same rng sequence.
    const strip = (r: typeof a) => ({
      ...r,
      scheduledItems: r.scheduledItems.map(({ id: _id, ...rest }) => rest),
    })
    expect(strip(a)).toEqual(strip(b))
  })

  it('schedules between 5 and 15 comments, all in the future and sorted', () => {
    const event = createGameEvent({ type: 'player_post', tags: ['big_moment'], timestamp: 1000 })
    const result = runReactionEngine({
      ...baseArgs,
      event,
      postId: 'post_1',
      npcs,
      rng: mulberry32(5),
    })
    expect(result.scheduledItems.length).toBeGreaterThanOrEqual(5)
    expect(result.scheduledItems.length).toBeLessThanOrEqual(15)
    for (const item of result.scheduledItems) {
      expect(item.dueAt).toBeGreaterThan(1000)
      expect(item.payload.parentPostId).toBe('post_1')
    }
    const dueAts = result.scheduledItems.map((i) => i.dueAt)
    expect(dueAts).toEqual([...dueAts].sort((a, b) => a - b))
  })

  it('only draws eligible personas for a controversial-only tag set', () => {
    const event = createGameEvent({ type: 'player_post', tags: ['controversial'], timestamp: 1000 })
    const result = runReactionEngine({
      ...baseArgs,
      event,
      postId: 'post_1',
      npcs,
      rng: mulberry32(11),
    })
    // controversial's eligible set is hater/tabloid/rival/loyal_fan/meme_account —
    // match_reporter and teammate should never be drawn for this tag alone.
    const commenterIds = new Set(result.scheduledItems.map((i) => i.payload.npcId))
    expect(commenterIds.has('npc_reporter')).toBe(false)
    expect(commenterIds.has('npc_teammate')).toBe(false)
  })

  it('produces non-negative engagement and a follower-growth stat effect', () => {
    const event = createGameEvent({ type: 'player_post', tags: ['huge_moment'], timestamp: 1000 })
    const result = runReactionEngine({
      ...baseArgs,
      event,
      postId: 'post_1',
      npcs,
      playerFollowers: 500_000,
      playerSocialScore: 80,
      rng: mulberry32(2),
    })
    expect(result.engagement.likes).toBeGreaterThan(0)
    expect(result.followerDelta).toBeGreaterThanOrEqual(0)
    expect(result.statDeltas.some((d) => d.type === 'followers')).toBe(true)
  })
})

describe('runSocialCircleEngine', () => {
  const circleArgs = {
    reactionPool: footballerPack.reactionPool,
    orgName: footballerPack.worldName,
    playerDisplayName: 'Alex Rennick',
    now: 1000,
  }

  it('guarantees a comment from every circle member, all aiEligible', () => {
    const event = createGameEvent({ type: 'player_post', tags: ['big_moment'], timestamp: 1000 })
    const result = runSocialCircleEngine({
      ...circleArgs,
      event,
      postId: 'post_1',
      circleNpcs: [npcs[0], npcs[1], npcs[2]],
      oddCelebrity: null,
      rng: mulberry32(1),
    })
    expect(result.scheduledItems).toHaveLength(3)
    const commenterIds = result.scheduledItems.map((i) => i.payload.npcId).sort()
    expect(commenterIds).toEqual(['npc_fan', 'npc_hater', 'npc_teammate'].sort())
    for (const item of result.scheduledItems) {
      expect(item.payload.aiEligible).toBe(true)
    }
  })

  it('includes the odd celebrity as a comment but never as a cross-reply target or replier', () => {
    const event = createGameEvent({ type: 'player_post', tags: ['big_moment'], timestamp: 1000 })
    const result = runSocialCircleEngine({
      ...circleArgs,
      event,
      postId: 'post_1',
      circleNpcs: [npcs[0], npcs[1]],
      oddCelebrity: npcs[4],
      rng: mulberry32(2),
    })
    expect(result.scheduledItems).toHaveLength(3)
    const celebrityItem = result.scheduledItems.find((i) => i.payload.npcId === 'npc_reporter')
    expect(celebrityItem).toBeDefined()
    expect(celebrityItem?.payload.replyFromNpcId).toBeUndefined()
    for (const item of result.scheduledItems) {
      expect(item.payload.replyFromNpcId).not.toBe('npc_reporter')
    }
  })

  it('never assigns a cross-reply from the same NPC replying to themselves', () => {
    const event = createGameEvent({ type: 'player_post', tags: ['big_moment'], timestamp: 1000 })
    for (let seed = 0; seed < 20; seed++) {
      const result = runSocialCircleEngine({
        ...circleArgs,
        event,
        postId: 'post_1',
        circleNpcs: [npcs[0], npcs[1], npcs[2], npcs[3]],
        oddCelebrity: null,
        rng: mulberry32(seed),
      })
      for (const item of result.scheduledItems) {
        if (item.payload.replyFromNpcId) {
          expect(item.payload.replyFromNpcId).not.toBe(item.payload.npcId)
        }
      }
    }
  })

  it('assigns at most 2 cross-replies, and none when the circle has under 2 members', () => {
    const event = createGameEvent({ type: 'player_post', tags: ['big_moment'], timestamp: 1000 })
    const solo = runSocialCircleEngine({
      ...circleArgs,
      event,
      postId: 'post_1',
      circleNpcs: [npcs[0]],
      oddCelebrity: null,
      rng: mulberry32(3),
    })
    expect(solo.scheduledItems.every((i) => !i.payload.replyFromNpcId)).toBe(true)

    const full = runSocialCircleEngine({
      ...circleArgs,
      event,
      postId: 'post_1',
      circleNpcs: npcs,
      oddCelebrity: null,
      rng: mulberry32(4),
    })
    const crossReplies = full.scheduledItems.filter((i) => i.payload.replyFromNpcId)
    expect(crossReplies.length).toBeLessThanOrEqual(2)
  })

  it('returns nothing when there are no circle members and no odd celebrity', () => {
    const event = createGameEvent({ type: 'player_post', tags: ['big_moment'], timestamp: 1000 })
    const result = runSocialCircleEngine({
      ...circleArgs,
      event,
      postId: 'post_1',
      circleNpcs: [],
      oddCelebrity: null,
      rng: mulberry32(5),
    })
    expect(result.scheduledItems).toEqual([])
  })
})
