// Only public things get public reactions — followers, tabloid stories, the
// crowd commenting. A quiet dinner for two or a private moment stays
// private; a club night, a premiere or a run-in with the paparazzi doesn't.

const PUBLIC_WORDS = [
  'public', 'crowd', 'fans', 'fan ', 'paparazzi', 'camera', 'cameras', 'press', 'interview', 'premiere', 'gala',
  'festival', 'stadium', 'concert', 'club', 'clubbing', 'party', 'after-party', 'afterparty', 'red carpet', 'livestream',
  'live stream', 'stream', 'photographed', 'spotted', 'viral', 'street', 'reporter', 'journalist', 'tv', 'award',
  'ceremony', 'signing', 'fashion week', 'match', 'rave', 'parade', 'autograph', 'selfie', 'filming', 'podcast',
]

const PUBLIC_TAGS = ['party', 'scandal_leak', 'rumor', 'big_moment', 'huge_moment', 'controversial', 'deal']

export function isPublicScene(text: string, tags: readonly string[] = []): boolean {
  const lower = ` ${text.toLowerCase()} `
  return tags.some((t) => PUBLIC_TAGS.includes(t)) || PUBLIC_WORDS.some((w) => lower.includes(w))
}

// A private moment can still get out — the paparazzi find out somehow.
export const LEAK_CHANCE = 0.15

export interface Publicity {
  isPublic: boolean
  leaked: boolean
}

export function resolvePublicity(text: string, tags: readonly string[], roll: number): Publicity {
  if (isPublicScene(text, tags)) return { isPublic: true, leaked: false }
  const leaked = roll < LEAK_CHANCE
  return { isPublic: leaked, leaked }
}
