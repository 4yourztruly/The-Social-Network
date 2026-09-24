import type { CareerPack, NPCSeed } from './careers/types'
import type { OnboardingInput } from './seed'
import { pick, randomInt, type RNG } from '../engine/rng'
import { dedupe, makeId } from '../engine/id'
import { crestAvatarUrl, pickNpcAvatarUrl } from '../engine/avatarSource'

// Deterministic, non-AI roster — used when the player hasn't configured an
// AI provider, or when AI roster generation fails/times out (see
// ai/rosterService.ts). Names here are all invented; this pool never claims
// to be a real person, unlike the AI path which the player explicitly opted
// into for that.

const FIRST_NAMES = [
  'Jordan', 'Casey', 'Morgan', 'Riley', 'Avery', 'Sam', 'Drew', 'Reese', 'Quinn', 'Rowan',
  'Ellis', 'Marlowe', 'Sasha', 'Devon', 'Kai', 'Noa', 'Theo', 'Leni', 'Bex', 'Finley',
]
const LAST_NAMES = [
  'Okafor', 'Bellweather', 'Marsh', 'Novak', 'Quinlan', 'Ashby', 'Duarte', 'Feld', 'Osei', 'Vance',
  'Larkspur', 'Whitlock', 'Rourke', 'Santoro', 'Iversen', 'Cade', 'Monroe', 'Blackwood', 'Faraday', 'Solis',
]
const MEME_NAMES = ['Daily Meme Vault', 'Locker Room Leaks', 'Unofficial Highlights', 'Chaos Timeline']

function randomName(rng: RNG): { first: string; last: string } {
  return { first: pick(rng, FIRST_NAMES), last: pick(rng, LAST_NAMES) }
}

function slug(...parts: string[]): string {
  return parts
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24)
}

// A realistic-looking handle a real person might actually pick — never a
// literal label like "hater" or "fan" baked in (that reads as a role tag,
// not a real username).
function randomHandle(first: string, last: string, rng: RNG): string {
  const f = first.toLowerCase()
  const l = last.toLowerCase()
  const patterns = [`${f}${l}`, `${f}.${l}`, `${f}_${l}`, `${f}${randomInt(rng, 1, 99)}`, `${f[0]}${l}`, `${f}.${l[0]}`]
  return slug(pick(rng, patterns))
}

function makeSeed(partial: Omit<NPCSeed, 'id' | 'postingStyle'>, rng: RNG): NPCSeed {
  return {
    id: makeId('npc'),
    postingStyle: {
      emoji: Math.round(rng() * 10) / 10,
      caps: Math.round(rng() * 10) / 10,
      hashtags: Math.round(rng() * 10) / 10,
    },
    ...partial,
  }
}

// Only the everyday public — fans, haters and meme accounts. The news
// outlets/tabloid are fixed (see content/universe.ts) and celebrities are
// added by the player, so neither is generated here.
export function buildFallbackRoster(
  pack: CareerPack,
  input: OnboardingInput,
  rng: RNG,
  // Usernames (and therefore most avatar URLs, which are seeded by
  // username) must be unique across the WHOLE roster — shared with the
  // fixed media and the player's celebs so nothing collides.
  usedUsernames: Set<string> = new Set(),
  // Pictures of the player's celebs, so a fan account can plausibly use one
  // as "who they're a fan of".
  celebAvatarUrls: string[] = [],
): NPCSeed[] {
  const orgForFlavor = input.org || pack.worldName
  const npcs: NPCSeed[] = []

  const commenterPersonas: NPCSeed['persona'][] = ['loyal_fan', 'hater', 'meme_account']
  for (let i = 0; i < 12; i++) {
    const persona = commenterPersonas[i % commenterPersonas.length]
    if (persona === 'meme_account') {
      const name = pick(rng, MEME_NAMES)
      const username = dedupe(slug(name, String(i)), usedUsernames)
      npcs.push(
        makeSeed(
          {
            username,
            displayName: name,
            bio: "Not affiliated with anyone. Please don't sue.",
            persona,
            personality: ['irreverent', 'quick'],
            verified: rng() < 0.4,
            followers: randomInt(rng, 5_000, 400_000),
            following: randomInt(rng, 1, 40),
            avatar: { kind: 'webp', value: crestAvatarUrl(username) },
          },
          rng,
        ),
      )
      continue
    }
    // Ordinary people, not role-labeled accounts — the fan/hater flavor
    // lives in the bio and personality, never in the display name or handle.
    // Their picture is whatever a real account might actually use: a
    // team-crest-like mark, a random non-portrait photo, or (sometimes,
    // for a fan account) a picture of a celeb elsewhere in this roster.
    const { first, last } = randomName(rng)
    const isHater = persona === 'hater'
    const username = dedupe(randomHandle(first, last, rng), usedUsernames)
    npcs.push(
      makeSeed(
        {
          username,
          displayName: `${first} ${last}`,
          bio: isHater ? 'Someone has to say it.' : `Supporting ${orgForFlavor} through everything.`,
          persona,
          personality: isHater ? ['blunt', 'contrarian'] : ['passionate', 'optimistic'],
          verified: false,
          followers: randomInt(rng, 200, 20_000),
          following: randomInt(rng, 100, 2_000),
          avatar: pickNpcAvatarUrl(username, rng, isHater ? [] : celebAvatarUrls),
        },
        rng,
      ),
    )
  }

  return npcs
}
