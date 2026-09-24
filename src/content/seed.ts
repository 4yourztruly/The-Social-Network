import type { CareerType, NPC, PlayerState, Post, Profile, RelationshipVibe, Settings, WorldSettings } from '../types'
import type { CareerPack, NPCSeed } from './careers/types'
import { fillTemplate } from '../engine/templates/filler'
import { mulberry32, pick, randomInt, type RNG } from '../engine/rng'
import { makeId } from '../engine/id'
import { isViewableProfile, tierForPersona } from '../engine/npcTier'
import { pushRecentLine, selectLine, selectPlainLine } from '../engine/templates/select'
import { applyPersonalityVoice } from '../engine/voice'
import { CROSS_MENTION_BANTER_LINES, fillBanterTarget } from '../engine/banter'
import { GENERIC_OFFTOPIC_POSTS, GENERIC_OFFTOPIC_REACTION_POOL } from './genericFiller'
import { estimateEngagement, estimateReplyEngagement, storyCommentCount } from '../engine/formulas'

// Stand-in "social score" (see engine/formulas.estimateEngagement — normally
// the player's humor+aura) used to size NPC-authored engagement numbers.
// Middle-of-the-road on purpose: NPCs aren't playing the stat game.
export const NPC_SOCIAL_SCORE = 45

// An offTopic NPC (a real celeb the AI picked for variety, unrelated to
// this career's world) never draws from this pack's sport/industry-flavored
// pools — see content/genericFiller.ts.
function postPoolFor(pack: CareerPack, npc: NPC): string[] | undefined {
  return npc.offTopic ? GENERIC_OFFTOPIC_POSTS : pack.seedPostPool[npc.persona]
}
function reactionPoolFor(pack: CareerPack, npc: NPC) {
  return npc.offTopic ? GENERIC_OFFTOPIC_REACTION_POOL : pack.reactionPool[npc.persona]
}

// Tabloid/insider accounts don't post generic filler ("you won't believe
// this...") — everything they say is a specific story about something that
// actually happened (see engine/gossip.ts), so they're left out of the
// random seeded posts, stories and replies.
export function isGenericPoster(npc: NPC): boolean {
  return npc.persona !== 'tabloid' && npc.persona !== 'insider'
}

// Who gets to start a post on the main feed: celebs and the news outlet.
// The general public (fans/haters/meme accounts) only comment and reply —
// unless they're @-ing the player, see dailyMentionPost.
function isFeedPoster(npc: NPC): boolean {
  return isGenericPoster(npc) && tierForPersona(npc.persona) !== 'commenter'
}

const MENTION_POST_LINES = [
  '@{player} you around? big fan honestly',
  '@{player} whatever you post next I am here for it',
  '@{player} need a reply from you today 🙏',
  'okay @{player} we need to talk about your last post 😂',
  '@{player} that last one was something else, respect',
  '@{player} still not over what you said earlier lol',
]

// Occasionally a member of the public posts something aimed at the player.
function dailyMentionPost(rng: RNG, npcs: Record<string, NPC>, playerUsername: string | undefined): Post | null {
  if (!playerUsername || rng() > 0.3) return null
  const pool = Object.values(npcs).filter((n) => tierForPersona(n.persona) === 'commenter')
  if (pool.length === 0) return null
  const author = pick(rng, pool)
  const line = pick(rng, MENTION_POST_LINES).replace('{player}', playerUsername)
  const engagement = estimateEngagement(rng, author.followers, NPC_SOCIAL_SCORE, [])
  return {
    id: makeId('post'),
    authorId: author.id,
    kind: 'post',
    text: applyPersonalityVoice(line, author, rng),
    tags: [],
    createdAt: Date.now() - randomInt(rng, 1, 180) * 60 * 1000,
    likes: engagement.likes,
    reposts: engagement.reposts,
    replies: randomInt(rng, 0, 4),
    origin: 'template',
  }
}

const PLAYER_ID = 'player'
const GAME_START = Date.UTC(2026, 6, 1) // fixed epoch for in-game time

export interface OnboardingInput {
  career: CareerType
  displayName: string
  username: string
  bio?: string
  role: string // '' if the player never said what they play/do
  org: string // '' if the player never named a club/label/team
  // Celebrities the player added at onboarding ("Customize your universe").
  celebs?: { name: string; description?: string }[]
}

export function createPlayerProfile(pack: CareerPack, input: OnboardingInput): Profile {
  return {
    id: PLAYER_ID,
    username: input.username,
    displayName: input.displayName,
    bio: input.bio?.trim() || pack.bioTemplate(input.role || pack.roleOptions[0], pack.worldName),
    avatar: { kind: 'initials', value: initialsFor(input.displayName) },
    verified: true,
    followers: 540_000,
    following: 12,
    joinedAt: GAME_START - 1000 * 60 * 60 * 24 * 365 * 3,
    isPlayer: true,
  }
}

export function createPlayerState(pack: CareerPack, input: OnboardingInput): PlayerState {
  return {
    profileId: PLAYER_ID,
    career: input.career,
    club: input.org, // exactly what the player said — may be '', never invented
    position: input.role, // exactly what the player said — may be '', never invented
    ratings: { ...pack.defaultRatings },
    traits: [],
    humor: 50,
    aura: 50,
    xp: 0,
  }
}

export function defaultWorldSettings(): WorldSettings {
  return { madness: 2, proactivity: 'medium' }
}

const DEFAULT_VIBE_BY_PERSONA: Record<NPC['persona'], RelationshipVibe> = {
  teammate: 'teammate_bond',
  coach: 'mentor',
  agent: 'friend',
  loyal_fan: 'fan',
  hater: 'frenemy',
  rival: 'rival',
  meme_account: 'fan',
  match_reporter: 'fan',
  insider: 'fan',
  tabloid: 'frenemy',
  celebrity: 'friend',
}

export function defaultVibeForPersona(persona: NPC['persona']): RelationshipVibe {
  return DEFAULT_VIBE_BY_PERSONA[persona]
}

// orgForFlavor is the org name NPC-authored content uses — the player's own
// org if they named one, otherwise the pack's fictional default. This is
// never written onto the player's own record; it only keeps the supporting
// cast's bios and posts grammatical when the player didn't specify a club.
function createNpcProfiles(npcSeeds: NPCSeed[], pack: CareerPack, rng: RNG, orgForFlavor: string): Record<string, NPC> {
  const npcs: Record<string, NPC> = {}
  for (const seed of npcSeeds) {
    npcs[seed.id] = {
      id: seed.id,
      username: seed.username,
      displayName: seed.displayName,
      bio: seed.bio.split(pack.worldName).join(orgForFlavor),
      avatar: seed.avatar ?? { kind: 'initials', value: initialsFor(seed.displayName) },
      verified: seed.verified,
      followers: seed.followers,
      following: seed.following,
      joinedAt: GAME_START - randomInt(rng, 100, 2000) * 1000 * 60 * 60 * 24,
      isPlayer: false,
      persona: seed.persona,
      personality: seed.personality,
      relationship: startingRelationship(seed.persona, rng),
      vibe: defaultVibeForPersona(seed.persona),
      mood: randomInt(rng, -2, 3),
      postingStyle: seed.postingStyle,
      recentLineIds: [],
      followedByPlayer: false,
      offTopic: seed.offTopic,
    }
  }
  return npcs
}

export function initialsFor(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// Every relationship starts neutral (0%) — nobody begins already liking or
// disliking the player, regardless of persona. It only moves from actual
// interactions (posts, replies, DMs, activities) from there.
function startingRelationship(_persona: NPC['persona'], _rng: RNG): number {
  return 0
}

function seedPosts(
  pack: CareerPack,
  rng: RNG,
  npcs: Record<string, NPC>,
  count: number,
  orgForFlavor: string,
): Post[] {
  const now = Date.now()
  // Any NPC tier can author a top-level post — commenter-tier NPCs (the
  // general public) still can't be followed/DMed or have a viewable
  // profile (see engine/npcTier.ts), but they post/comment/reply just
  // like everyone else.
  const npcList = Object.values(npcs).filter(isFeedPoster)
  const posts: Post[] = []
  for (let i = 0; i < count && npcList.length > 0; i++) {
    const author = pick(rng, npcList)
    const lines = postPoolFor(pack, author)
    if (!lines || lines.length === 0) continue
    // Anti-repetition, same as replies/live comments — without this the
    // same handful of authors (small line pools) visibly repeated
    // themselves across the ~45-post opening feed.
    const selection = selectPlainLine(rng, lines, author.recentLineIds)
    author.recentLineIds = pushRecentLine(author.recentLineIds, selection.lineId)
    const text = fillTemplate(selection.line, { org: orgForFlavor, org_upper: orgForFlavor.toUpperCase() })
    const ageMs = randomInt(rng, 5, 60 * 24) * 60 * 1000 // 5 min to 60 hours ago
    const engagement = estimateEngagement(rng, author.followers, NPC_SOCIAL_SCORE, [])
    posts.push({
      id: makeId('post'),
      authorId: author.id,
      kind: 'post',
      text,
      tags: [],
      createdAt: now - ageMs,
      likes: engagement.likes,
      reposts: engagement.reposts,
      replies: randomInt(rng, 0, 20),
      origin: 'template',
    })
  }
  return posts.sort((a, b) => b.createdAt - a.createdAt)
}

// Same idea as seedPosts, but for a live game already in progress — a small,
// recent batch (a couple minutes to a few hours old, not up to 60h) dropped
// into the feed each time the in-game day advances (see gameStore.advanceDay).
export function seedDailyPosts(
  pack: CareerPack,
  rng: RNG,
  npcs: Record<string, NPC>,
  count: number,
  orgForFlavor: string,
  playerUsername?: string,
): Post[] {
  const now = Date.now()
  const npcList = Object.values(npcs).filter(isFeedPoster)
  const posts: Post[] = []
  for (let i = 0; i < count && npcList.length > 0; i++) {
    const author = pick(rng, npcList)
    const lines = postPoolFor(pack, author)
    if (!lines || lines.length === 0) continue
    const selection = selectPlainLine(rng, lines, author.recentLineIds)
    author.recentLineIds = pushRecentLine(author.recentLineIds, selection.lineId)
    const text = fillTemplate(selection.line, { org: orgForFlavor, org_upper: orgForFlavor.toUpperCase() })
    // News outlets usually break the day's stories first, so they land at
    // the bottom of the day's batch and everyone else can react above them.
    const newsFirst = tierForPersona(author.persona) === 'media' && rng() < 0.85
    const ageMs = newsFirst ? randomInt(rng, 181, 300) * 60 * 1000 : randomInt(rng, 1, 180) * 60 * 1000 // 1 min to 3h ago
    const engagement = estimateEngagement(rng, author.followers, NPC_SOCIAL_SCORE, [])
    posts.push({
      id: makeId('post'),
      authorId: author.id,
      kind: 'post',
      text,
      tags: [],
      createdAt: now - ageMs,
      likes: engagement.likes,
      reposts: engagement.reposts,
      replies: randomInt(rng, 0, 15),
      origin: 'template',
    })
  }
  const mention = dailyMentionPost(rng, npcs, playerUsername)
  if (mention) posts.push(mention)
  return posts.sort((a, b) => b.createdAt - a.createdAt)
}

// A commenter who replies at all only does so 1-3 times per thread — caps
// how many of a post's `replies` slots any single NPC can fill, so one
// account doesn't dominate the comment section.
const MAX_REPLIES_PER_COMMENTER = 3

// A thread has at most a couple of replies that @-mention an earlier
// commenter instead of reacting to the original post — banter between
// commenters, not literal understanding of what was said.
const MAX_MENTION_REPLIES_PER_THREAD = 2
const MENTION_REPLY_CHANCE = 0.35

// Materializes an actual reply Post for every one of a seed post's `replies`
// count — without this, that number was purely cosmetic (PostThread looks
// up replies by parentId, and none ever existed for seeded posts, so
// opening one always showed "No replies yet" no matter what it claimed).
// Reuses the same reactionPool/selectLine/personality-voice pipeline as
// live in-game comments, just generated synchronously in a batch. Any NPC
// tier can reply here (unlike seedPosts/seedStories) — commenting is what
// commenter-tier NPCs exist to do.
export function seedReplies(
  pack: CareerPack,
  rng: RNG,
  npcs: Record<string, NPC>,
  topLevelPosts: Post[],
  orgForFlavor: string,
  // Comment texts to steer clear of — shared across every parent in the
  // call (and seeded by callers with what other stories already have) so
  // two stories don't end up with the same comment section.
  avoidTexts: Set<string> = new Set(),
): Post[] {
  const now = Date.now()
  const npcList = Object.values(npcs)
  const recentLineIdsByNpc: Record<string, string[]> = {}
  const replies: Post[] = []

  for (const parent of topLevelPosts) {
    if (parent.replies <= 0) continue
    const parentAuthor = npcs[parent.authorId]
    const candidates = npcList.filter((n) => n.id !== parent.authorId && isGenericPoster(n))
    if (candidates.length === 0) continue

    // Decide who comments before generating any text: draws from the full
    // candidate pool each slot, but drops anyone who's already hit their
    // per-thread cap, so a handful of accounts can't eat every slot.
    const usageCount: Record<string, number> = {}
    const commenterPlan: NPC[] = []
    for (let i = 0; i < parent.replies; i++) {
      const eligible = candidates.filter((c) => (usageCount[c.id] ?? 0) < MAX_REPLIES_PER_COMMENTER)
      if (eligible.length === 0) break
      const commenter = pick(rng, eligible)
      usageCount[commenter.id] = (usageCount[commenter.id] ?? 0) + 1
      commenterPlan.push(commenter)
    }

    const usedLineIdsThisThread: string[] = []
    const threadReplies: Post[] = []
    let mentionsLeft = Math.min(MAX_MENTION_REPLIES_PER_THREAD, Math.max(0, commenterPlan.length - 1))

    for (const commenter of commenterPlan) {
      const priorRecent = recentLineIdsByNpc[commenter.id] ?? commenter.recentLineIds
      const mentionCandidates = threadReplies.filter((r) => r.authorId !== commenter.id)
      const mentionTarget =
        mentionsLeft > 0 && mentionCandidates.length > 0 && rng() < MENTION_REPLY_CHANCE
          ? pick(rng, mentionCandidates)
          : undefined

      let text: string
      if (mentionTarget) {
        const targetNpc = npcs[mentionTarget.authorId]
        const line = pick(rng, CROSS_MENTION_BANTER_LINES)
        text = applyPersonalityVoice(fillBanterTarget(line, targetNpc.username), commenter, rng)
        mentionsLeft -= 1
      } else {
        const linePool = reactionPoolFor(pack, commenter)
        if (!linePool) continue
        // Merges this NPC's own anti-repetition history with every line
        // already used elsewhere in this thread, so two different
        // commenters don't land on the same canned line back to back.
        const recentLineIds = [...priorRecent, ...usedLineIdsThisThread]
        let candidate = ''
        for (let attempt = 0; attempt < 8; attempt++) {
          const selection = selectLine(rng, linePool, [], recentLineIds)
          // Reaction lines are written as "reply to whoever's post this is" —
          // {player} fills with the post's actual author, not the game's player.
          const filled = fillTemplate(selection.line, { player: parentAuthor?.displayName ?? '', org: orgForFlavor })
          candidate = applyPersonalityVoice(filled, commenter, rng)
          recentLineIdsByNpc[commenter.id] = pushRecentLine(priorRecent, selection.lineId)
          usedLineIdsThisThread.push(selection.lineId)
          recentLineIds.push(selection.lineId)
          if (!avoidTexts.has(candidate)) break
        }
        text = candidate
      }

      avoidTexts.add(text)
      const createdAt = Math.min(now, parent.createdAt + randomInt(rng, 1, 120) * 60 * 1000)
      const replyEngagement = estimateReplyEngagement(rng, commenter.followers, NPC_SOCIAL_SCORE)
      const reply: Post = {
        id: makeId('post'),
        authorId: commenter.id,
        kind: 'reply',
        parentId: parent.id,
        text,
        tags: [],
        createdAt,
        likes: replyEngagement.likes,
        reposts: replyEngagement.reposts,
        replies: 0,
        origin: 'template',
      }
      threadReplies.push(reply)
      replies.push(reply)
    }
  }
  return replies
}

const STORY_TTL_MS = 24 * 60 * 60 * 1000

// A handful of NPCs start with a live story, so the stories row isn't empty
// on day one. Reuses the seed post pool for flavor text rather than
// authoring a separate story-only pool — the content need is the same
// (a short first-person line), only the lifecycle (expiresAt) differs.
function seedStories(
  pack: CareerPack,
  rng: RNG,
  npcs: Record<string, NPC>,
  count: number,
  orgForFlavor: string,
): Post[] {
  const now = Date.now()
  const npcList = Object.values(npcs).filter((n) => isViewableProfile(n) && isGenericPoster(n))
  const chosen = new Set<string>()
  const stories: Post[] = []
  for (let i = 0; i < count * 3 && chosen.size < count && chosen.size < npcList.length; i++) {
    const author = pick(rng, npcList)
    if (chosen.has(author.id)) continue
    const lines = postPoolFor(pack, author)
    if (!lines || lines.length === 0) continue
    chosen.add(author.id)
    const line = pick(rng, lines)
    const text = fillTemplate(line, { org: orgForFlavor, org_upper: orgForFlavor.toUpperCase() })
    const ageMs = randomInt(rng, 5, 12 * 60) * 60 * 1000 // 5 min to 12h ago
    const createdAt = now - ageMs
    stories.push({
      id: makeId('post'),
      authorId: author.id,
      kind: 'story',
      text,
      tags: [],
      createdAt,
      expiresAt: createdAt + STORY_TTL_MS,
      likes: 0,
      reposts: 0,
      // Same idea as a top-level post's `replies` — a target count that
      // seedReplies materializes into actual comment Posts, so opening a
      // story's comments isn't always empty.
      replies: storyCommentCount(rng, author.followers),
      origin: 'template',
    })
  }
  return stories
}

export function defaultSettings(): Settings {
  return {
    theme: 'system',
    aiEnabled: false,
  }
}

export interface SeededWorld {
  player: PlayerState
  profiles: Record<string, Profile | NPC>
  posts: Record<string, Post>
  postOrder: string[]
}

export function createSeededWorld(
  pack: CareerPack,
  input: OnboardingInput,
  seed = Date.now(),
  npcSeeds: NPCSeed[] = pack.npcs,
): SeededWorld {
  const rng = mulberry32(seed)
  const orgForFlavor = input.org || pack.worldName
  const npcs = createNpcProfiles(npcSeeds, pack, rng, orgForFlavor)
  const playerProfile = createPlayerProfile(pack, input)
  const posts = seedPosts(pack, rng, npcs, 45, orgForFlavor)
  const stories = seedStories(pack, rng, npcs, 6, orgForFlavor)
  // Stories get comments too, same mechanism as posts — seedReplies doesn't
  // care about `kind`, just that `replies` is a target count to fill in.
  const replies = seedReplies(pack, rng, npcs, [...posts, ...stories], orgForFlavor)

  const profiles: Record<string, Profile | NPC> = { [playerProfile.id]: playerProfile, ...npcs }
  const postsRecord: Record<string, Post> = {}
  const postOrder: string[] = []
  // The whole seeded world is created at once, before the game clock ever
  // advances — everything in it belongs to Day 1 (see Feed's day dividers).
  for (const post of [...posts, ...stories, ...replies].sort((a, b) => b.createdAt - a.createdAt)) {
    post.gameDay = 1
    postsRecord[post.id] = post
    postOrder.push(post.id)
  }

  return {
    player: createPlayerState(pack, input),
    profiles,
    posts: postsRecord,
    postOrder,
  }
}

export { PLAYER_ID }
