import type { CareerType, NPC, PlayerState, Post, Profile, RelationshipVibe, Settings, WorldSettings } from '../types'
import type { CareerPack } from './careers/types'
import { fillTemplate } from '../engine/templates/filler'
import { mulberry32, pick, randomInt, type RNG } from '../engine/rng'
import { makeId } from '../engine/id'
import { isViewableProfile } from '../engine/npcTier'
import { pushRecentLine, selectLine } from '../engine/templates/select'
import { applyPersonalityVoice } from '../engine/voice'
import { CROSS_MENTION_BANTER_LINES, fillBanterTarget } from '../engine/banter'

const PLAYER_ID = 'player'
const GAME_START = Date.UTC(2026, 6, 1) // fixed epoch for in-game time

export interface OnboardingInput {
  career: CareerType
  displayName: string
  username: string
  bio?: string
  role: string // '' if the player never said what they play/do
  org: string // '' if the player never named a club/label/team
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
}

export function defaultVibeForPersona(persona: NPC['persona']): RelationshipVibe {
  return DEFAULT_VIBE_BY_PERSONA[persona]
}

// orgForFlavor is the org name NPC-authored content uses — the player's own
// org if they named one, otherwise the pack's fictional default. This is
// never written onto the player's own record; it only keeps the supporting
// cast's bios and posts grammatical when the player didn't specify a club.
function createNpcProfiles(pack: CareerPack, rng: RNG, orgForFlavor: string): Record<string, NPC> {
  const npcs: Record<string, NPC> = {}
  for (const seed of pack.npcs) {
    npcs[seed.id] = {
      id: seed.id,
      username: seed.username,
      displayName: seed.displayName,
      bio: seed.bio.split(pack.worldName).join(orgForFlavor),
      avatar: { kind: 'initials', value: initialsFor(seed.displayName) },
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

function startingRelationship(persona: NPC['persona'], rng: RNG): number {
  switch (persona) {
    case 'teammate':
    case 'coach':
    case 'agent':
      return randomInt(rng, 20, 50)
    case 'loyal_fan':
      return randomInt(rng, 40, 70)
    case 'rival':
    case 'hater':
      return randomInt(rng, -50, -10)
    default:
      return randomInt(rng, -10, 20)
  }
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
  const npcList = Object.values(npcs)
  const posts: Post[] = []
  for (let i = 0; i < count; i++) {
    const author = pick(rng, npcList)
    const lines = pack.seedPostPool[author.persona]
    if (!lines || lines.length === 0) continue
    const line = pick(rng, lines)
    const text = fillTemplate(line, { org: orgForFlavor, org_upper: orgForFlavor.toUpperCase() })
    const ageMs = randomInt(rng, 5, 60 * 24) * 60 * 1000 // 5 min to 60 hours ago
    posts.push({
      id: makeId('post'),
      authorId: author.id,
      kind: 'post',
      text,
      tags: [],
      createdAt: now - ageMs,
      likes: randomInt(rng, 0, Math.round(author.followers / 4000)),
      reposts: randomInt(rng, 0, Math.round(author.followers / 12000)),
      replies: randomInt(rng, 0, 20),
      origin: 'template',
    })
  }
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
function seedReplies(
  pack: CareerPack,
  rng: RNG,
  npcs: Record<string, NPC>,
  topLevelPosts: Post[],
  orgForFlavor: string,
): Post[] {
  const now = Date.now()
  const npcList = Object.values(npcs)
  const recentLineIdsByNpc: Record<string, string[]> = {}
  const replies: Post[] = []

  for (const parent of topLevelPosts) {
    if (parent.replies <= 0) continue
    const parentAuthor = npcs[parent.authorId]
    const candidates = npcList.filter((n) => n.id !== parent.authorId)
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
        const linePool = pack.reactionPool[commenter.persona]
        if (!linePool) continue
        // Merges this NPC's own anti-repetition history with every line
        // already used elsewhere in this thread, so two different
        // commenters don't land on the same canned line back to back.
        const recentLineIds = [...priorRecent, ...usedLineIdsThisThread]
        const selection = selectLine(rng, linePool, [], recentLineIds)
        recentLineIdsByNpc[commenter.id] = pushRecentLine(priorRecent, selection.lineId)
        usedLineIdsThisThread.push(selection.lineId)
        // Reaction lines are written as "reply to whoever's post this is" —
        // {player} fills with the post's actual author, not the game's player.
        const filled = fillTemplate(selection.line, { player: parentAuthor?.displayName ?? '', org: orgForFlavor })
        text = applyPersonalityVoice(filled, commenter, rng)
      }

      const createdAt = Math.min(now, parent.createdAt + randomInt(rng, 1, 120) * 60 * 1000)
      const reply: Post = {
        id: makeId('post'),
        authorId: commenter.id,
        kind: 'reply',
        parentId: parent.id,
        text,
        tags: [],
        createdAt,
        likes: randomInt(rng, 0, 30),
        reposts: 0,
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
  const npcList = Object.values(npcs).filter(isViewableProfile)
  const chosen = new Set<string>()
  const stories: Post[] = []
  for (let i = 0; i < count * 3 && chosen.size < count && chosen.size < npcList.length; i++) {
    const author = pick(rng, npcList)
    if (chosen.has(author.id)) continue
    const lines = pack.seedPostPool[author.persona]
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
      replies: 0,
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

export function createSeededWorld(pack: CareerPack, input: OnboardingInput, seed = Date.now()): SeededWorld {
  const rng = mulberry32(seed)
  const orgForFlavor = input.org || pack.worldName
  const npcs = createNpcProfiles(pack, rng, orgForFlavor)
  const playerProfile = createPlayerProfile(pack, input)
  const posts = seedPosts(pack, rng, npcs, 45, orgForFlavor)
  const stories = seedStories(pack, rng, npcs, 6, orgForFlavor)
  const replies = seedReplies(pack, rng, npcs, posts, orgForFlavor)

  const profiles: Record<string, Profile | NPC> = { [playerProfile.id]: playerProfile, ...npcs }
  const postsRecord: Record<string, Post> = {}
  const postOrder: string[] = []
  for (const post of [...posts, ...stories, ...replies].sort((a, b) => b.createdAt - a.createdAt)) {
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
