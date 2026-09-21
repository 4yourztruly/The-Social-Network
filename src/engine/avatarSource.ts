// Picks a profile picture for a generated account. Real people (AI-generated
// celeb/media entries) get an attempt at their actual photo via Wikipedia's
// public, CORS-enabled summary API — no key needed, and it silently returns
// nothing if the page doesn't exist or has no image. Invented people (NPCs,
// and the non-AI fallback roster entirely) get a deterministic illustrated
// avatar instead, seeded by their handle — never a real photo, since they
// aren't real.

export function dicebearAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`
}

const WIKI_TIMEOUT_MS = 6_000

// Returns a photo URL, or null if the page doesn't exist, has no image, or
// the request fails/times out — callers should fall back to
// dicebearAvatarUrl in that case, never leave the entry without an avatar.
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
