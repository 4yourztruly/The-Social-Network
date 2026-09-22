import type { CareerPack, NPCSeed } from './careers/types'
import type { OnboardingInput } from './seed'
import { pick, randomInt, type RNG } from '../engine/rng'
import { makeId } from '../engine/id'
import { crestAvatarUrl, dicebearAvatarUrl, pickNpcAvatarUrl } from '../engine/avatarSource'

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
const NEWS_TEMPLATES = ['{org} Daily', 'The {org} Wire', '{org} Report', 'Inside {org}']
const TABLOID_TEMPLATES = ['The Velvet Rope', 'Backstage Files', 'After Hours Report', 'The Insider Scoop']

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

export function buildFallbackRoster(pack: CareerPack, input: OnboardingInput, rng: RNG): NPCSeed[] {
  const orgForFlavor = input.org || pack.worldName
  const npcs: NPCSeed[] = []

  // Celebs first — nobody in the fallback pool is real, so these stay
  // illustrated portraits (there's no photo to fetch), but building them
  // first means fan-account NPCs below can plausibly use one as "who
  // they're a fan of".
  const celebPersonas: NPCSeed['persona'][] = ['teammate', 'coach', 'agent', 'rival']
  const celebAvatarUrls: string[] = []
  for (let i = 0; i < 8; i++) {
    const persona = celebPersonas[i % celebPersonas.length]
    const { first, last } = randomName(rng)
    const displayName = `${first} ${last}`
    const username = randomHandle(first, last, rng)
    const avatarUrl = dicebearAvatarUrl(username)
    celebAvatarUrls.push(avatarUrl)
    const bioByPersona: Record<string, string> = {
      teammate: `${input.role || pack.roleOptions[0]} @ ${orgForFlavor}.`,
      coach: `Manager, ${orgForFlavor}. Results business.`,
      agent: 'Deals, not drama. (mostly)',
      rival: `${input.role || pack.roleOptions[0]}, elsewhere. Not sorry.`,
    }
    npcs.push(
      makeSeed(
        {
          username,
          displayName,
          bio: bioByPersona[persona],
          persona,
          personality: persona === 'rival' ? ['cocky', 'sarcastic'] : ['confident', 'driven'],
          verified: true,
          followers: randomInt(rng, 150_000, 4_000_000),
          following: randomInt(rng, 50, 900),
          avatar: { kind: 'webp', value: avatarUrl },
        },
        rng,
      ),
    )
  }

  for (let i = 0; i < 2; i++) {
    const template = pick(rng, NEWS_TEMPLATES)
    const name = template.replace('{org}', orgForFlavor)
    const username = slug(name, String(i))
    npcs.push(
      makeSeed(
        {
          username,
          displayName: name,
          bio: `Covering ${orgForFlavor} and the wider ${pack.label.toLowerCase()} world.`,
          persona: 'match_reporter',
          personality: ['measured', 'thorough'],
          verified: true,
          followers: randomInt(rng, 80_000, 900_000),
          following: randomInt(rng, 200, 900),
          avatar: { kind: 'webp', value: crestAvatarUrl(username) },
        },
        rng,
      ),
    )
  }

  for (let i = 0; i < 2; i++) {
    const name = TABLOID_TEMPLATES[i % TABLOID_TEMPLATES.length]
    const username = slug(name, String(i))
    npcs.push(
      makeSeed(
        {
          username,
          displayName: name,
          bio: 'Rumours, gossip, and whatever nobody wanted printed.',
          persona: 'tabloid',
          personality: ['nosy', 'gleeful'],
          verified: true,
          followers: randomInt(rng, 100_000, 1_500_000),
          following: randomInt(rng, 10, 60),
          avatar: { kind: 'webp', value: crestAvatarUrl(username) },
        },
        rng,
      ),
    )
  }

  const commenterPersonas: NPCSeed['persona'][] = ['loyal_fan', 'hater', 'meme_account']
  for (let i = 0; i < 12; i++) {
    const persona = commenterPersonas[i % commenterPersonas.length]
    if (persona === 'meme_account') {
      const name = pick(rng, MEME_NAMES)
      const username = slug(name, String(i))
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
    const username = randomHandle(first, last, rng)
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
