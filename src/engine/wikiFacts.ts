// Looks a real person up on Wikipedia (public, CORS-enabled, no key) so the
// game — and the AI writing as them — knows what they're actually known for
// (their shows, films, music, sport), not just a name. Returns the lead
// section as plain text, or null when there's no confident match (an
// invented name, a network failure, ...). Never throws.

const TIMEOUT_MS = 6000
const MAX_FACT_CHARS = 900

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
}

// The search's top hit has to actually be about this person: most of the
// name's words must appear in the article title.
export function titleMatchesName(name: string, title: string): boolean {
  const words = normalize(name).split(/\s+/).filter((w) => w.length > 1)
  if (words.length === 0) return false
  const titleNorm = normalize(title)
  const hits = words.filter((w) => titleNorm.includes(w)).length
  return hits >= Math.max(1, Math.ceil(words.length * 0.6))
}

export function trimFacts(extract: string): string {
  const clean = extract.replace(/\s+/g, ' ').trim()
  if (clean.length <= MAX_FACT_CHARS) return clean
  const cut = clean.slice(0, MAX_FACT_CHARS)
  const lastStop = cut.lastIndexOf('. ')
  return lastStop > 300 ? cut.slice(0, lastStop + 1) : cut
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`wiki ${res.status}`)
  return res.json()
}

export async function fetchWikipediaFacts(name: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const search = (await getJson(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=1&format=json&origin=*`,
      controller.signal,
    )) as { query?: { search?: { title: string }[] } }
    const title = search.query?.search?.[0]?.title
    if (!title || !titleMatchesName(name, title)) return null
    const page = (await getJson(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`,
      controller.signal,
    )) as { query?: { pages?: Record<string, { extract?: string }> } }
    const extract = Object.values(page.query?.pages ?? {})[0]?.extract
    if (!extract || extract.trim().length < 40) return null
    return trimFacts(extract)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
