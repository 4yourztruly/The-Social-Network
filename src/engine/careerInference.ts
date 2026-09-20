import type { CareerType } from '../types'

// Infers which career pack a player's bio belongs to, so onboarding can be
// "write who you are" instead of "pick from a list" — the words in the bio
// place the player in that world's social circle (roster, feed, reactions).
// Deterministic and keyword-based; the AI layer (Milestone 6) may refine
// this later, but it must never be the only path (offline-first).

const CAREER_SIGNALS: Record<CareerType, string[]> = {
  footballer: [
    'football',
    'footballer',
    'soccer',
    'striker',
    'midfielder',
    'defender',
    'goalkeeper',
    'winger',
    'pitch',
    'premier league',
    ' fc',
    'derby',
    'club captain',
    'academy',
  ],
  rapper: [
    'rapper',
    ' rap ',
    'rap artist',
    'hip hop',
    'hip-hop',
    'mixtape',
    'bars',
    'verse',
    'mc ',
    'trap',
    'freestyle',
    'beats',
    'studio session',
    'label',
  ],
  singer: [
    'singer',
    'vocalist',
    'pop star',
    'vocals',
    'songwriter',
    'ballad',
    'melody',
    'tour',
    'album',
    'concert',
    'music video',
    'choir',
  ],
  baseball_player: [
    'baseball',
    'pitcher',
    'outfielder',
    'infielder',
    'catcher',
    'shortstop',
    'batting',
    'home run',
    'bullpen',
    'diamond',
    'dugout',
    'mlb',
  ],
}

// Order matters only as a deterministic tie-break when no signal matches.
const DEFAULT_CAREER: CareerType = 'footballer'

export function inferCareerFromBio(bio: string): CareerType {
  const text = ` ${bio.toLowerCase()} `
  let best: CareerType = DEFAULT_CAREER
  let bestScore = 0
  for (const [career, signals] of Object.entries(CAREER_SIGNALS) as [CareerType, string[]][]) {
    const score = signals.reduce((count, signal) => count + (text.includes(signal) ? 1 : 0), 0)
    if (score > bestScore) {
      best = career
      bestScore = score
    }
  }
  return best
}

// What the player actually IS should come from their own words, not a
// picklist — "right winger for Real Madrid" means exactly that, not
// whatever position/club the career pack happens to default to. These are
// ordered longest-phrase-first so "right winger" wins over the bare
// "winger". Falls back to the pack's default role only when nothing in the
// bio matches — there is always no-AI, offline-capable behavior.
const ROLE_VOCAB: Record<CareerType, string[]> = {
  footballer: [
    'defensive midfielder',
    'attacking midfielder',
    'central midfielder',
    'left back',
    'right back',
    'left winger',
    'right winger',
    'wing back',
    'centre back',
    'center back',
    'full back',
    'goalkeeper',
    'sweeper',
    'midfielder',
    'defender',
    'striker',
    'winger',
    'forward',
    'playmaker',
  ],
  rapper: ['rapper-producer', 'battle rapper', 'hype man', 'ghostwriter', 'lyricist', 'producer', 'rapper', 'mc'],
  singer: [
    'lead vocalist',
    'backup vocalist',
    'singer-songwriter',
    'opera singer',
    'choir singer',
    'pop singer',
    'songwriter',
    'vocalist',
    'singer',
  ],
  baseball_player: [
    'starting pitcher',
    'relief pitcher',
    'first baseman',
    'second baseman',
    'third baseman',
    'center fielder',
    'left fielder',
    'right fielder',
    'designated hitter',
    'shortstop',
    'outfielder',
    'infielder',
    'catcher',
    'pitcher',
    'closer',
  ],
}

function titleCase(phrase: string): string {
  return phrase
    .split(/[\s-]+/)
    .map((w) => (w.toUpperCase() === 'MC' ? 'MC' : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
}

// Picks whichever role phrase the player actually wrote first — not
// whichever the vocab list happens to prioritize — so "MC and producer"
// yields "MC", matching their own word order.
export function extractRoleFromBio(bio: string, career: CareerType): string | null {
  const text = ` ${bio.toLowerCase()} `
  let bestPhrase: string | null = null
  let bestIndex = Infinity
  for (const phrase of ROLE_VOCAB[career]) {
    const padded = ` ${phrase}`
    const index = text.indexOf(padded)
    if (index === -1) continue
    const after = text[index + padded.length]
    if (after !== ' ' && after !== '.' && after !== ',') continue
    if (index < bestIndex || (index === bestIndex && phrase.length > (bestPhrase?.length ?? 0))) {
      bestIndex = index
      bestPhrase = phrase
    }
  }
  return bestPhrase ? titleCase(bestPhrase) : null
}

// Captures the org name after "for/at/with/to/@" — "right winger for real
// madrid" -> "Real Madrid". Doesn't require capitalization (people type
// bios casually), so it grabs a run of words and truncates at the first
// word that reads like ordinary sentence continuation rather than a name.
// A light heuristic, not NLP — it will miss or over-grab occasionally, but
// it never invents a name that isn't in the player's own text.
const ORG_CAPTURE_PATTERN = /\b(?:for|at|with|to|@|representing)\s+([A-Za-z][\w'&.-]*(?:\s+[A-Za-z][\w'&.-]*){0,5})/
const ORG_STOP_WORDS = new Set([
  'and', 'but', 'or', 'while', 'because', 'since', 'when', 'who', 'which', 'that',
  'the', 'a', 'an', 'my', 'our', 'this', 'some',
  'in', 'on', 'at', 'for', 'with', 'to',
  'fun', 'now', 'life', 'work', 'school', 'training', 'practice', 'home', 'money', 'free',
])

export function extractOrgFromBio(bio: string): string | null {
  const match = ORG_CAPTURE_PATTERN.exec(bio)
  if (!match) return null
  const kept: string[] = []
  for (const word of match[1].split(/\s+/)) {
    if (ORG_STOP_WORDS.has(word.toLowerCase())) break
    kept.push(word)
  }
  if (kept.length === 0) return null
  return kept.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}
