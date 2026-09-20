import type { CareerType, NPC, PlayerState, Post, Profile, RelationshipVibe, Settings, WorldSettings } from '../types'
import type { CareerPack } from './careers/types'
import { fillTemplate } from '../engine/templates/filler'
import { mulberry32, pick, randomInt, type RNG } from '../engine/rng'
import { makeId } from '../engine/id'

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
    fame: 55,
    morale: 60,
    form: 60,
    traits: [],
    hype: 50,
    charisma: 55,
    reputation: 60,
    controversy: 5,
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
  const npcList = Object.values(npcs)
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

  const profiles: Record<string, Profile | NPC> = { [playerProfile.id]: playerProfile, ...npcs }
  const postsRecord: Record<string, Post> = {}
  const postOrder: string[] = []
  for (const post of [...posts, ...stories].sort((a, b) => b.createdAt - a.createdAt)) {
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
