// Picks a profile picture for a generated account.
//
// Real people (AI-generated celeb/media entries) get an attempt at their
// actual photo via Wikipedia's public, CORS-enabled summary API — no key
// needed, and it silently returns nothing if the page doesn't exist or has
// no image.
//
// Invented people (NPCs, and the entire non-AI fallback roster) never get a
// fake "portrait" — real accounts' pictures are all over the place: a team
// crest, a car, a random object photo, or a fan account using a picture of
// whoever they're a fan of. See pickNpcAvatarUrl.

export function dicebearAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`
}

// An abstract geometric mark — reads like a crest/badge/logo, not a face.
export function crestAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed)}`
}

// A simple icon-on-a-background mark — reads like "a picture of a thing"
// (an object, a symbol) rather than a face. Deliberately NOT a random stock
// photo service: those can return anything (closeups, unrelated/odd
// subjects) with no quality control, which was landing as "avatars that
// don't fit". Everything here is a deterministic SVG, so quality is
// consistent by construction.
export function iconAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/icons/svg?seed=${encodeURIComponent(seed)}`
}

// Picks which kind of picture an ordinary (invented) NPC would plausibly
// have. `celebAvatarPool` is the set of already-resolved celeb avatar URLs
// elsewhere in this same roster, so a fan account can plausibly be using a
// picture of whoever they're a fan of — skipped entirely if that pool is
// empty.
export function pickNpcAvatarUrl(seed: string, rng: () => number, celebAvatarPool: readonly string[] = []): { kind: 'webp'; value: string } {
  const canBeFanOf = celebAvatarPool.length > 0
  const roll = rng()
  if (canBeFanOf && roll < 0.2) {
    return { kind: 'webp', value: celebAvatarPool[Math.floor(rng() * celebAvatarPool.length)] }
  }
  const remaining = canBeFanOf ? (roll - 0.2) / 0.8 : roll
  if (remaining < 0.4) return { kind: 'webp', value: crestAvatarUrl(seed) }
  if (remaining < 0.75) return { kind: 'webp', value: iconAvatarUrl(seed) }
  return { kind: 'webp', value: dicebearAvatarUrl(seed) }
}

const WIKI_TIMEOUT_MS = 6_000

// Returns a photo URL, or null if the page doesn't exist, has no image, or
// the request fails/times out — callers should fall back to another avatar
// source in that case, never leave the entry without one.
export async function fetchWikipediaThumbnail(name: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WIKI_TIMEOUT_MS)
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { thumbnail?: { source?: string }; type?: string }
    if (data.type === 'disambiguation') return null
    return data.thumbnail?.source ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
