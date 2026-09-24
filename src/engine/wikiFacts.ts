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

// ---- On-demand lookups -----------------------------------------------------
// When the player brings something up mid-conversation (a show, a film, a
// place, a person), look it up right then so the reply can actually know it.

const STOP_TOPICS = new Set([
  'i', 'im', 'ill', 'ive', 'id', 'the', 'a', 'an', 'hey', 'hi', 'hello', 'yes', 'no', 'ok', 'okay', 'lol', 'omg',
  'what', 'why', 'how', 'when', 'where', 'who', 'do', 'did', 'are', 'is', 'was', 'you', 'your', 'we', 'so', 'and',
  'but', 'thanks', 'thank', 'please', 'sure', 'well', 'maybe', 'good', 'great', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday', 'sunday', 'today', 'tonight', 'tomorrow',
])

// Capitalised phrases and quoted strings, skipping ordinary sentence openers.
export function extractTopics(message: string, max = 3): string[] {
  const found: string[] = []
  const add = (t: string) => {
    const clean = t.trim().replace(/[.,!?;:]+$/, '')
    if (clean.length < 3 || found.some((f) => f.toLowerCase() === clean.toLowerCase())) return
    found.push(clean)
  }
  for (const m of message.matchAll(/["“']([^"”']{3,40})["”']/g)) add(m[1])
  for (const m of message.matchAll(/\b([A-Z][\w'’-]*(?:\s+(?:of|the|and|&)?\s*[A-Z][\w'’-]*)*)/g)) {
    const phrase = m[1]
    const first = phrase.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '')
    const isLoneOpener = !phrase.includes(' ') && STOP_TOPICS.has(first)
    if (!isLoneOpener && !STOP_TOPICS.has(first)) add(phrase)
    else if (phrase.includes(' ')) add(phrase.split(/\s+/).slice(1).join(' '))
  }
  return found.slice(0, max)
}

const articleCache = new Map<string, string | null>()
const topicCache = new Map<string, string | null>()

async function fetchFullArticle(title: string, signal: AbortSignal): Promise<string | null> {
  if (articleCache.has(title)) return articleCache.get(title) ?? null
  try {
    const page = (await getJson(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exchars=15000&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`,
      signal,
    )) as { query?: { pages?: Record<string, { extract?: string }> } }
    const text = Object.values(page.query?.pages ?? {})[0]?.extract ?? null
    articleCache.set(title, text)
    return text
  } catch {
    return null
  }
}

// Sentences of the person's own article that mention the topic — what a
// person would actually know about e.g. their own show or film.
async function factsAboutPersonAndTopic(personName: string, topic: string, signal: AbortSignal): Promise<string | null> {
  const search = (await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(personName)}&srlimit=1&format=json&origin=*`,
    signal,
  )) as { query?: { search?: { title: string }[] } }
  const title = search.query?.search?.[0]?.title
  if (!title || !titleMatchesName(personName, title)) return null
  const article = await fetchFullArticle(title, signal)
  if (!article) return null
  const words = normalize(topic).split(/\s+/).filter((w) => w.length > 2)
  if (words.length === 0) return null
  const sentences = article.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/)
  const hits = sentences.filter((s) => {
    const n = normalize(s)
    return words.every((w) => n.includes(w))
  })
  return hits.length > 0 ? hits.slice(0, 3).join(' ').slice(0, 600) : null
}

async function factsAboutTopic(topic: string, signal: AbortSignal): Promise<string | null> {
  const search = (await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=1&format=json&origin=*`,
    signal,
  )) as { query?: { search?: { title: string }[] } }
  const title = search.query?.search?.[0]?.title
  if (!title || !titleMatchesName(topic, title)) return null
  const page = (await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exchars=500&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`,
    signal,
  )) as { query?: { pages?: Record<string, { extract?: string }> } }
  const extract = Object.values(page.query?.pages ?? {})[0]?.extract
  return extract && extract.trim().length > 30 ? `${title}: ${extract.replace(/\s+/g, ' ').trim()}` : null
}

// What to add to a prompt when the player says something that names things.
// `personName` is the character who'll be answering, so their own article is
// checked first for the topic (their role in a show, a song of theirs, ...).
// Returns '' when nothing is found; never throws.
export async function lookupForMessage(message: string, personName: string): Promise<string> {
  const topics = extractTopics(message).filter((t) => normalize(t).trim() !== normalize(personName).trim())
  // A question about their own career/life needs no named topic.
  const aboutThem = lookupAboutPerson(message, personName)
  if (topics.length === 0) return aboutThem
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const results = await Promise.all(
      topics.map(async (topic) => {
        const key = `${personName}|${topic.toLowerCase()}`
        if (topicCache.has(key)) return topicCache.get(key) ?? null
        let facts: string | null = null
        try {
          const own = await factsAboutPersonAndTopic(personName, topic, controller.signal)
          const general = await factsAboutTopic(topic, controller.signal)
          facts = [own ? `About ${personName} and "${topic}": ${own}` : '', general ?? ''].filter(Boolean).join(' ') || null
        } catch {
          facts = null
        }
        topicCache.set(key, facts)
        return facts
      }),
    )
    return [await aboutThem, ...results].filter(Boolean).join('\n')
  } finally {
    clearTimeout(timeout)
  }
}

// ---- Questions about the person themselves -----------------------------------
// "What roles have you been in?" names nothing to look up — but it's plainly
// about the person's own career, so pull that from their article.

const SELF_TOPICS: { ask: RegExp; keys: string[] }[] = [
  {
    ask: /\b(roles?|movies?|films?|shows?|series|tv|television|played|starred|acting|acted|cast|filmography|screen|projects?|worked on|characters?)\b/i,
    keys: ['role', 'film', 'series', 'starred', 'cast', 'played', 'portray', 'appear', 'television', 'movie', 'lead', 'debut', 'drama'],
  },
  {
    ask: /\b(songs?|albums?|music|singing|sing|discography|tour|band|singles?|record)\b/i,
    keys: ['album', 'song', 'single', 'tour', 'released', 'music', 'record', 'chart', 'debut'],
  },
  {
    ask: /\b(team|club|sport|football|soccer|basketball|tennis|league|season|goals?|match|played for|transfer)\b/i,
    keys: ['club', 'team', 'season', 'goal', 'league', 'match', 'signed', 'joined', 'national'],
  },
  {
    ask: /\b(born|grew up|from|hometown|childhood|family|age|old are you|raised|school)\b/i,
    keys: ['born', 'raised', 'grew up', 'moved', 'family', 'attended', 'school', 'hometown'],
  },
  {
    ask: /\b(career|known for|famous|awards?|break ?through|started|big break|success)\b/i,
    keys: ['known', 'career', 'award', 'nominated', 'breakthrough', 'role', 'won', 'began', 'started'],
  },
]

export async function lookupAboutPerson(message: string, personName: string): Promise<string> {
  const matched = SELF_TOPICS.filter((t) => t.ask.test(message))
  if (matched.length === 0) return ''
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const search = (await getJson(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(personName)}&srlimit=1&format=json&origin=*`,
      controller.signal,
    )) as { query?: { search?: { title: string }[] } }
    const title = search.query?.search?.[0]?.title
    if (!title || !titleMatchesName(personName, title)) return ''
    const article = await fetchFullArticle(title, controller.signal)
    if (!article) return ''
    const keys = matched.flatMap((t) => t.keys)
    const sentences = article.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/)
    const picked: string[] = []
    let total = 0
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase()
      if (!keys.some((k) => lower.includes(k))) continue
      if (sentence.length > 320) continue
      picked.push(sentence)
      total += sentence.length
      if (total > 1600) break
    }
    return picked.length > 0 ? `About ${personName}'s own life and work (from Wikipedia — answer from these, never invent titles): ${picked.join(' ')}` : ''
  } catch {
    return ''
  } finally {
    clearTimeout(timeout)
  }
}
