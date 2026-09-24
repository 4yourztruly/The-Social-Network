import type { NPCSeed } from './careers/types'
import { dedupe, makeId } from '../engine/id'
import { crestAvatarUrl, pickNpcAvatarUrl } from '../engine/avatarSource'
import { randomInt, type RNG } from '../engine/rng'

// What every universe contains no matter what: the news outlets and the
// tabloid are fixed (CNN + Sky Sports, TMZ), not generated or role-assigned
// per game. Everyone else who's famous is a celebrity the player adds
// themselves at onboarding — no predetermined teammate/coach/agent/rival.

export interface FixedMediaDef {
  username: string
  displayName: string
  bio: string
  persona: 'match_reporter' | 'tabloid'
  personality: string[]
  followers: number
  following: number
}

export const FIXED_MEDIA: FixedMediaDef[] = [
  {
    username: 'CNN',
    displayName: 'CNN',
    bio: 'Breaking news and analysis from around the world.',
    persona: 'match_reporter',
    personality: ['measured', 'thorough'],
    followers: 60_000_000,
    following: 1_100,
  },
  {
    username: 'SkySports',
    displayName: 'Sky Sports',
    bio: 'Live sport, breaking news, transfers and analysis.',
    persona: 'match_reporter',
    personality: ['energetic', 'thorough'],
    followers: 12_000_000,
    following: 900,
  },
  {
    username: 'TMZ',
    displayName: 'TMZ',
    bio: 'Celebrity news, gossip and exclusives.',
    persona: 'tabloid',
    personality: ['nosy', 'gleeful'],
    followers: 20_000_000,
    following: 60,
  },
]

export function buildFixedMediaSeeds(rng: RNG): NPCSeed[] {
  return FIXED_MEDIA.map((def) => ({
    id: makeId('npc'),
    username: def.username,
    displayName: def.displayName,
    bio: def.bio,
    persona: def.persona,
    personality: def.personality,
    verified: true,
    followers: def.followers,
    following: def.following,
    postingStyle: {
      emoji: Math.round(rng() * 5) / 10,
      caps: Math.round(rng() * 3) / 10,
      hashtags: Math.round(rng() * 5) / 10,
    },
    avatar: { kind: 'webp' as const, value: crestAvatarUrl(def.username) },
  }))
}

export interface CelebInput {
  name: string
  description?: string // optional personality/who-they-are hint from the player
}

const KNOWN_TRAITS = [
  'funny', 'sarcastic', 'competitive', 'chill', 'shy', 'loud', 'dramatic', 'playful', 'blunt',
  'loyal', 'passionate', 'confident', 'optimistic', 'moody', 'wholesome', 'chaotic', 'cocky',
  'friendly', 'ambitious', 'private', 'flirty', 'quirky',
]

// Pulls trait words the player already wrote out of their free-text
// description — deterministic and instant, used when there's no AI to
// research the person. Empty when the description doesn't contain any.
export function personalityFromDescription(description: string): string[] {
  const text = description.toLowerCase()
  return KNOWN_TRAITS.filter((t) => text.includes(t)).slice(0, 4)
}

export interface CelebDetails {
  bio?: string
  personality?: string[]
  followers?: number
  verified?: boolean
  avatarUrl?: string | null
}

// Turns one player-added celeb into a roster seed. Celebrities are
// deliberately roleless and career-agnostic (offTopic) — whatever they post
// comes from generic filler or the AI in their own voice, never from a
// sport/industry pool.
export function buildCelebSeed(
  input: CelebInput,
  details: CelebDetails | null,
  rng: RNG,
  usedUsernames: Set<string>,
): NPCSeed {
  const name = input.name.trim()
  const description = input.description?.trim() ?? ''
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'celeb'
  const username = dedupe(base, usedUsernames)
  const avatarUrl = details?.avatarUrl ?? null
  return {
    id: makeId('npc'),
    username,
    displayName: name,
    bio: (details?.bio ?? description).slice(0, 160),
    persona: 'celebrity',
    personality: details?.personality?.length ? details.personality : personalityFromDescription(description),
    verified: details?.verified ?? true,
    followers: details?.followers && details.followers > 0 ? details.followers : randomInt(rng, 1_000_000, 30_000_000),
    following: randomInt(rng, 50, 900),
    postingStyle: {
      emoji: Math.round(rng() * 10) / 10,
      caps: Math.round(rng() * 4) / 10,
      hashtags: Math.round(rng() * 5) / 10,
    },
    avatar: avatarUrl ? { kind: 'webp' as const, value: avatarUrl } : pickNpcAvatarUrl(username, rng),
    offTopic: true,
  }
}
