import type { Persona } from '../types'

// A player-created custom person only ever gives a name and a bio — no
// "public role" picker (see PROJECT_SPEC.md section 17.5 "custom people").
// This infers which content pool/eligibility persona best fits them from
// that text alone, so e.g. naming someone "TMZ" with bio "tabloid celeb
// news" makes them post/react like the rest of the tabloid roster, without
// an AI call (deterministic, instant, always available — same "gameplay
// never blocks on AI" rule as everywhere else). Checked in priority order;
// first match wins. Falls back to 'loyal_fan', the safest generic default.
const PERSONA_KEYWORDS: { persona: Persona; keywords: string[] }[] = [
  {
    persona: 'tabloid',
    keywords: ['tabloid', 'gossip', 'paparazzi', 'paps', 'celeb news', 'celebrity news', 'scoop', 'exclusive'],
  },
  { persona: 'insider', keywords: ['insider', 'leak', 'leaks', 'source close to'] },
  {
    persona: 'match_reporter',
    keywords: ['reporter', 'journalist', 'correspondent', 'news', 'press', 'analyst', 'broadcaster'],
  },
  { persona: 'meme_account', keywords: ['meme', 'parody', 'satire', 'fan page', 'fan account', 'fan edits'] },
  { persona: 'coach', keywords: ['coach', 'trainer', 'mentor'] },
  { persona: 'agent', keywords: ['agent', 'management', 'manager'] },
  { persona: 'rival', keywords: ['rival', 'nemesis', 'opponent', 'enemy'] },
  { persona: 'hater', keywords: ['hater', 'critic', 'troll', 'clown'] },
  { persona: 'teammate', keywords: ['teammate', 'bandmate', 'co-star', 'costar', 'training partner', 'colleague'] },
]

export function inferPersonaFromBio(name: string, bio: string): Persona {
  const text = `${name} ${bio}`.toLowerCase()
  for (const { persona, keywords } of PERSONA_KEYWORDS) {
    if (keywords.some((k) => text.includes(k))) return persona
  }
  return 'loyal_fan'
}
