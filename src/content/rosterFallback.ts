import type { CareerPack, NPCSeed } from './careers/types'
import type { OnboardingInput } from './seed'
import { pick, randomInt, type RNG } from '../engine/rng'
import { makeId } from '../engine/id'

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
const FAN_PREFIXES = ['Diehard', 'True', 'Forever', 'Real', 'Loyal', 'Certified', 'Official']
const HATER_ADJECTIVES = ['Blunt', 'Salty', 'Unfiltered', 'Honest', 'Cold Take']
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

  for (let i = 0; i < 2; i++) {
    const template = pick(rng, NEWS_TEMPLATES)
    const name = template.replace('{org}', orgForFlavor)
    npcs.push(
      makeSeed(
        {
          username: slug(name, String(i)),
          displayName: name,
          bio: `Covering ${orgForFlavor} and the wider ${pack.label.toLowerCase()} world.`,
          persona: 'match_reporter',
          personality: ['measured', 'thorough'],
          verified: true,
          followers: randomInt(rng, 80_000, 900_000),
          following: randomInt(rng, 200, 900),
        },
        rng,
      ),
    )
  }

  for (let i = 0; i < 2; i++) {
    const name = TABLOID_TEMPLATES[i % TABLOID_TEMPLATES.length]
    npcs.push(
      makeSeed(
        {
          username: slug(name, String(i)),
          displayName: name,
          bio: 'Rumours, gossip, and whatever nobody wanted printed.',
          persona: 'tabloid',
          personality: ['nosy', 'gleeful'],
          verified: true,
          followers: randomInt(rng, 100_000, 1_500_000),
          following: randomInt(rng, 10, 60),
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
      npcs.push(
        makeSeed(
          {
            username: slug(name, String(i)),
            displayName: name,
            bio: "Not affiliated with anyone. Please don't sue.",
            persona,
            personality: ['irreverent', 'quick'],
            verified: rng() < 0.4,
            followers: randomInt(rng, 5_000, 400_000),
            following: randomInt(rng, 1, 40),
          },
          rng,
        ),
      )
      continue
    }
    const { first, last } = randomName(rng)
    const isHater = persona === 'hater'
    const label = isHater ? pick(rng, HATER_ADJECTIVES) : pick(rng, FAN_PREFIXES)
    const displayName = isHater ? `${label} ${first}` : `${label} ${orgForFlavor} Fan`
    npcs.push(
      makeSeed(
        {
          username: slug(first, last, String(i)),
          displayName,
          bio: isHater ? "Someone has to say it." : `Supporting ${orgForFlavor} through everything.`,
          persona,
          personality: isHater ? ['blunt', 'contrarian'] : ['passionate', 'optimistic'],
          verified: false,
          followers: randomInt(rng, 200, 20_000),
          following: randomInt(rng, 100, 2_000),
        },
        rng,
      ),
    )
  }

  const celebPersonas: NPCSeed['persona'][] = ['teammate', 'coach', 'agent', 'rival']
  for (let i = 0; i < 8; i++) {
    const persona = celebPersonas[i % celebPersonas.length]
    const { first, last } = randomName(rng)
    const displayName = `${first} ${last}`
    const bioByPersona: Record<string, string> = {
      teammate: `${input.role || pack.roleOptions[0]} @ ${orgForFlavor}.`,
      coach: `Manager, ${orgForFlavor}. Results business.`,
      agent: 'Deals, not drama. (mostly)',
      rival: `${input.role || pack.roleOptions[0]}, elsewhere. Not sorry.`,
    }
    npcs.push(
      makeSeed(
        {
          username: slug(first, last),
          displayName,
          bio: bioByPersona[persona],
          persona,
          personality: persona === 'rival' ? ['cocky', 'sarcastic'] : ['confident', 'driven'],
          verified: true,
          followers: randomInt(rng, 150_000, 4_000_000),
          following: randomInt(rng, 50, 900),
        },
        rng,
      ),
    )
  }

  return npcs
}
