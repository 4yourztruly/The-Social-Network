import type { NPC } from '../types'
import { hashStringToSeed } from './rng'
import { tierForPersona } from './npcTier'

// Who would actually react to a post, and how. Real people don't all pile
// onto "Hala Madrid": the fans of that club cheer, its rivals wind it up,
// other football people give it a nod, and everyone who doesn't follow
// football just scrolls past. This decides which of those an NPC is, from
// what we know about them (their Wikipedia lead, bio, persona).

export type Stance =
  | 'skip' // not their thing — they wouldn't comment
  | 'fan' // they belong to the group the post is about — enthusiastic, insider
  | 'rival' // they're on the other side — banter, a dig, never joining in
  | 'neutral' // they follow the area but aren't partisan — a respectful nod
  | 'supportive' // a peer or friend reacting to something in their own world

interface Club {
  key: string
  label: string
  terms: string[]
  rivals: string[]
}

const CLUBS: Club[] = [
  { key: 'real_madrid', label: 'Real Madrid', terms: ['real madrid', 'hala madrid', 'madridista', 'bernabeu', 'bernabéu', 'los blancos'], rivals: ['barcelona', 'atletico'] },
  { key: 'barcelona', label: 'FC Barcelona', terms: ['barcelona', 'barça', 'barca', 'visca barça', 'blaugrana', 'camp nou', 'cules'], rivals: ['real_madrid'] },
  { key: 'atletico', label: 'Atlético Madrid', terms: ['atletico', 'atlético', 'atleti'], rivals: ['real_madrid'] },
  { key: 'man_utd', label: 'Manchester United', terms: ['manchester united', 'man utd', 'man united', 'old trafford', 'red devils', 'glory glory'], rivals: ['man_city', 'liverpool'] },
  { key: 'man_city', label: 'Manchester City', terms: ['manchester city', 'man city', 'etihad', 'cityzens'], rivals: ['man_utd'] },
  { key: 'liverpool', label: 'Liverpool', terms: ['liverpool', 'ynwa', "you'll never walk alone", 'anfield'], rivals: ['man_utd'] },
  { key: 'arsenal', label: 'Arsenal', terms: ['arsenal', 'gunners', 'north london red'], rivals: ['tottenham'] },
  { key: 'tottenham', label: 'Tottenham', terms: ['tottenham', 'spurs', 'coys'], rivals: ['arsenal'] },
  { key: 'chelsea', label: 'Chelsea', terms: ['chelsea', 'stamford bridge'], rivals: ['arsenal', 'tottenham'] },
  { key: 'bayern', label: 'Bayern Munich', terms: ['bayern', 'mia san mia'], rivals: ['dortmund'] },
  { key: 'dortmund', label: 'Borussia Dortmund', terms: ['dortmund', 'bvb'], rivals: ['bayern'] },
  { key: 'psg', label: 'Paris Saint-Germain', terms: ['psg', 'paris saint-germain', 'paris saint germain'], rivals: ['marseille'] },
  { key: 'juventus', label: 'Juventus', terms: ['juventus', 'juve', 'fino alla fine'], rivals: ['inter', 'milan'] },
  { key: 'inter', label: 'Inter Milan', terms: ['inter milan', 'internazionale', 'forza inter'], rivals: ['milan', 'juventus'] },
  { key: 'milan', label: 'AC Milan', terms: ['ac milan', 'forza milan', 'rossoneri'], rivals: ['inter', 'juventus'] },
]

function hasTerm(lowerText: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i').test(lowerText)
}

// Which club a piece of text is about, if it names one.
export function clubIn(text: string): Club | undefined {
  const lower = text.toLowerCase()
  return CLUBS.find((c) => c.terms.some((t) => hasTerm(lower, t)))
}

// The club a person supports/plays for. Real people: whichever club their
// lead names first. Everyday accounts have no article, so they get a stable
// allegiance (or none) from their id — some fans are Madridistas, some aren't.
export function clubOf(npc: NPC): Club | undefined {
  const own = [npc.knowledge, npc.bio].filter(Boolean).join(' ')
  const lower = own.toLowerCase()
  let best: { club: Club; at: number } | undefined
  for (const club of CLUBS) {
    for (const term of club.terms) {
      const m = new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').exec(lower)
      if (m && (!best || m.index < best.at)) best = { club, at: m.index }
    }
  }
  if (best) return best.club
  if (tierForPersona(npc.persona) === 'commenter') {
    const roll = hashStringToSeed(`${npc.id}_club`) % 100
    if (roll < 55) return CLUBS[hashStringToSeed(`${npc.id}_which`) % 9]
  }
  return undefined
}

type Domain = 'football' | 'music' | 'acting' | 'comedy' | 'fashion' | 'sport'

const POST_DOMAINS: Record<Domain, RegExp> = {
  football:
    /\b(goal|goals|match|penalty|transfer|striker|winger|pitch|derby|champions league|premier league|la liga|world cup|kick ?off|hat-?trick|football|soccer|clean sheet|ucl|fixture|matchday|derbi)\b/i,
  music: /\b(album|song|single|tour|concert|studio|lyrics|track|gig|setlist|new music|mixtape)\b/i,
  acting: /\b(film|movie|series|season|filming|premiere|role|episode|script|cast|netflix|hbo|set life|trailer)\b/i,
  comedy: /\b(joke|stand-?up|comedy|roast|sketch|bit)\b/i,
  fashion: /\b(outfit|fashion|runway|photoshoot|designer|campaign|collection|fit check|met gala)\b/i,
  sport: /\b(basketball|nba|tennis|olympic|olympics|gym|workout|race|f1|nfl|marathon|training|playoffs|championship)\b/i,
}

const NPC_DOMAINS: Record<Domain, RegExp> = {
  football:
    /\b(footballer|association football|soccer|premier league|la liga|striker|winger|midfielder|goalkeeper|defender|bundesliga|serie a|ligue 1|champions league|football)\b/i,
  music: /\b(singer|songwriter|rapper|musician|album|band|dj|recording artist|vocalist)\b/i,
  acting: /\b(actress|actor|film|films|television|tv series|series|screen)\b/i,
  comedy: /\b(comedian|stand-?up|comedy|humorist)\b/i,
  fashion: /\b(model|fashion|designer|influencer|creator|youtuber|tiktok|streamer)\b/i,
  sport: /\b(basketball|tennis|athlete|gymnast|olympic|nba|nfl|sprinter|swimmer|boxer|golfer|racing driver|formula one)\b/i,
}

function postDomains(text: string): Domain[] {
  return (Object.keys(POST_DOMAINS) as Domain[]).filter((d) => POST_DOMAINS[d].test(text))
}

export function npcInto(npc: NPC, domain: Domain): boolean {
  const own = [npc.knowledge, npc.bio].filter(Boolean).join(' ')
  if (NPC_DOMAINS[domain].test(own)) return true
  // "sport" is an umbrella that includes football people.
  if (domain === 'sport' && NPC_DOMAINS.football.test(own)) return true
  return false
}

// How this NPC would react to `postText`, or 'skip' if they'd stay out of it.
// Deterministic for a given NPC and post, so re-rolling doesn't change minds.
export function reactionStance(npc: NPC, postText: string): Stance {
  const tier = tierForPersona(npc.persona)
  const post = clubIn(postText)

  if (post) {
    const mine = clubOf(npc)
    if (mine && mine.key === post.key) return 'fan'
    if (mine && post.rivals.includes(mine.key)) return npc.personality.some((t) => ['shy', 'wholesome', 'private'].includes(t)) ? 'skip' : 'rival'
    if (npc.persona === 'hater' && tier === 'commenter') return 'rival'
    if (npcInto(npc, 'football') || (tier === 'commenter' && mine)) return 'neutral'
    return 'skip'
  }

  const domains = postDomains(postText)
  if (domains.length > 0) {
    if (domains.some((d) => npcInto(npc, d))) return 'supportive'
    // Outside their world: only someone close would chime in, and only sometimes.
    if (tier === 'commenter') return hashStringToSeed(`${npc.id}_${postText}`) % 100 < 25 ? 'supportive' : 'skip'
    if (npc.relationship >= 40 && hashStringToSeed(`${npc.id}_${postText}`) % 100 < 35) return 'supportive'
    return 'skip'
  }

  // A personal, general post — anyone friendly might react; celebs who
  // barely know the player mostly don't.
  if (tier === 'commenter') return 'supportive'
  if (npc.relationship >= 10) return 'supportive'
  return hashStringToSeed(`${npc.id}_${postText}`) % 100 < 40 ? 'supportive' : 'skip'
}

// What to tell the AI about the stance, and the loyalties behind it.
export function stanceInstruction(stance: Stance, npc: NPC, postText: string): string {
  const club = clubOf(npc)
  const post = clubIn(postText)
  const allegiance = club ? `You support/play for ${club.label}.` : ''
  switch (stance) {
    case 'fan':
      return `${allegiance} This is about YOUR side — react like an insider who genuinely belongs to it.`
    case 'rival':
      return `${allegiance || 'You are not part of this group.'} This is about ${post?.label ?? 'a rival'} — you are on the other side. Do NOT echo their chant or slogan. React with playful rivalry, a dig or banter, in your own voice.`
    case 'neutral':
      return `${allegiance} You follow football but are not part of this club. Give a respectful nod at most. Do NOT chant or repeat their slogan.`
    case 'supportive':
      return 'A peer/friend reacting. Warm and genuine, no fanatic chanting; only speak to what fits your own world.'
    default:
      return ''
  }
}

const RIVAL_LINES = [
  'Enjoy it while it lasts 😏',
  'Bold of you to say that in front of me 😂',
  '{mine} supremacy though, no offence 😌',
  'Respect, but we both know how this ends',
  'Not on my timeline, sorry 😂',
]
const RIVAL_LINES_NO_CLUB = ['Overhyped, respectfully 😏', 'Nice try 😂', "We'll see about that"]
const NEUTRAL_LINES = [
  'Respect to {post}, always a serious side 🤝',
  "Can't argue with the history there",
  'Fair play, {post} do it right',
  'Proper club, credit where it is due',
]

// A reaction that fits the stance — a rival winding you up, a neutral nod —
// for when there's no better (AI-written) line.
export function stanceLine(rng: () => number, stance: Stance, npc: NPC, postText: string): string | null {
  const mine = clubOf(npc)
  const post = clubIn(postText)
  const choose = (list: string[]) => list[Math.floor(rng() * list.length)]
  if (stance === 'rival') {
    return mine ? choose(RIVAL_LINES).replace('{mine}', mine.label) : choose(RIVAL_LINES_NO_CLUB)
  }
  if (stance === 'neutral') return choose(NEUTRAL_LINES).replace('{post}', post?.label ?? 'that lot')
  return null
}
