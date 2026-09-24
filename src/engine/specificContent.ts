import type { NPC, WorldStory } from '../types'
import { extractTopics } from './wikiFacts'
import { pick, type RNG } from './rng'

// Posts and comments that are about SOMETHING — a specific project, a
// specific thing someone just said — instead of canned filler. Used whenever
// the AI isn't writing them, so the world never sounds generic.

const NOT_A_TOPIC = new Set([
  'american', 'british', 'english', 'french', 'spanish', 'german', 'italian', 'canadian', 'australian', 'brazilian',
  'netflix', 'hbo', 'hulu', 'amazon', 'disney', 'she', 'he', 'they', 'his', 'her', 'their', 'it', 'the', 'in', 'on',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'a', 'an', 'known', 'born', 'best', 'also', 'and', 'for', 'her roles', 'roles', 'film', 'series', 'actress', 'actor',
  'singer', 'model', 'footballer', 'player', 'rapper', 'songwriter', 'television', 'united states', 'england', 'uk', 'usa',
])

// The works, places and people a real celeb is known for, pulled out of the
// Wikipedia lead we looked up (npc.knowledge) — not the person's own name.
export function celebTopics(npc: NPC): string[] {
  const source = [npc.knowledge, npc.bio].filter(Boolean).join(' ')
  if (!source) return []
  const nameWords = npc.displayName.toLowerCase().split(/\s+/)
  return extractTopics(source, 12).filter((t) => {
    const lower = t.toLowerCase()
    if (NOT_A_TOPIC.has(lower)) return false
    const words = lower.split(/\s+/)
    if (words.every((w) => nameWords.includes(w))) return false
    // A phrase that's mostly the person's own name ("Madelyn Renee Cline").
    if (words.filter((w) => nameWords.includes(w)).length >= 2) return false
    return t.length >= 4
  })
}

const TOPIC_POSTS = [
  'Rewatching {topic} tonight and honestly it still gets me 🙌',
  "Still can't get over how much {topic} changed things for me",
  'Throwback to {topic} — the best people, the best days',
  "Every time someone brings up {topic} I get the biggest smile. Thank you for all the love on it 🙏",
  'People keep asking me about {topic}. Ask me anything, I mean it 👇',
  'Been thinking about {topic} all day. Grateful is an understatement',
  'Nothing beats the feeling of people connecting with {topic}. You are all amazing',
  "If you haven't seen {topic} yet, this is your sign 🎬",
]

const STORY_POSTS = [
  "Not commenting on the {other} rumors… nice try, but no 😂",
  'The way everyone is talking about me and {other} right now. Y\'all need hobbies 😂',
  "For the record: {other} is a good person and that's all I'll say about it",
]

// A post that is actually about something, or null when there's nothing
// specific to say — better silent than generic.
export function specificCelebPost(rng: RNG, npc: NPC, stories: readonly WorldStory[], names: Record<string, string>): string | null {
  const own = stories.filter((s) => s.people.includes(npc.id)).slice(-3)
  if (own.length > 0 && rng() < 0.4) {
    const otherId = own[own.length - 1].people.find((id) => id !== npc.id && id !== 'player')
    const other = otherId ? names[otherId] : undefined
    if (other) return pick(rng, STORY_POSTS).replace('{other}', other)
  }
  const topics = celebTopics(npc)
  if (topics.length === 0) return null
  return pick(rng, TOPIC_POSTS).replace('{topic}', pick(rng, topics))
}

// ---- comments that answer the post -------------------------------------------

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'always', 'because', 'before', 'being', 'could', 'doing', 'every', 'going', 'great',
  'having', 'their', 'there', 'these', 'thing', 'things', 'think', 'those', 'today', 'tonight', 'really', 'still',
  'something', 'would', 'where', 'which', 'while', 'with', 'without', 'just', 'like', 'much', 'more', 'some', 'very',
  'what', 'when', 'from', 'have', 'that', 'this', 'they', 'them', 'been', 'over', 'into', 'only', 'other', 'than',
])

// What a post is about: a name/title in it, or failing that its most
// distinctive word.
export function postTopic(text: string): string | null {
  const proper = extractTopics(text, 1)[0]
  if (proper) return proper
  const words = text
    .toLowerCase()
    .replace(/[^a-z' ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOP_WORDS.has(w))
  if (words.length === 0) return null
  return words.sort((a, b) => b.length - a.length)[0]
}

const COMMENT_TEMPLATES: Record<string, string[]> = {
  loyal_fan: [
    '{topic}!! you always deliver 😭',
    'Been waiting for something about {topic} all week, thank you',
    '{topic} is everything, this made my day',
    'Not {author} making me emotional about {topic} 🥹',
    "Okay but {topic} — I'm obsessed",
  ],
  hater: [
    'Ok but is {topic} really that deep?',
    '{topic} again? We get it',
    "Respectfully, {topic} is overrated",
    'Can we talk about something other than {topic} for once',
  ],
  meme_account: [
    'me pretending to be normal about {topic} 💀',
    '{topic} discourse is back on the timeline',
    'the {topic} arc continues',
    'nobody: … {author}: {topic}',
  ],
  default: [
    'Love this — {topic} was so good',
    'Wait, {topic}? Tell me everything',
    'The {topic} part got me 😂',
    'This is so {author} honestly. {topic}!',
  ],
}

// A comment that reacts to what the post actually says, or null when there's
// no clear topic to react to.
export function relatedComment(rng: RNG, postText: string, postAuthorName: string, persona: string): string | null {
  const topic = postTopic(postText)
  if (!topic) return null
  const pool = COMMENT_TEMPLATES[persona] ?? COMMENT_TEMPLATES.default
  return pick(rng, pool).split('{topic}').join(topic).split('{author}').join(postAuthorName)
}

// ---- a celeb answering the player publicly ------------------------------------

const ACK_POSTS: Record<string, string[]> = {
  reply: [
    'Shoutout to @{player} for having my back today 🙏 that meant a lot',
    'Thank you @{player} — some people really show up and you did',
    '@{player} appreciate you saying that publicly. Not forgotten',
  ],
  activity: [
    'Had the best time with @{player} — {detail}. Real ones 🙌',
    "Can't stop smiling after {detail} with @{player}",
  ],
  event: [
    '@{player} what a moment. Still processing 😂',
    'Well that was unexpected — thanks for being there @{player}',
  ],
  post: [
    "@{player} you can't just post that and expect me not to answer 😂",
    'Saw your post @{player}. Yes, I meant every word of what I said back',
  ],
  story: [
    '@{player} loved your story today, made my whole feed better',
  ],
}

// Coy, deliberately vague — only when the two of them are keeping something quiet.
const SECRET_POSTS = [
  'Lovely evening yesterday 😉 more soon…',
  'Some people just make ordinary nights feel special 🤍',
  'Not saying where I was last night. Not saying who with either 👀',
]

export function acknowledgementPost(rng: RNG, kind: keyof typeof ACK_POSTS, playerUsername: string, detail: string): string {
  return pick(rng, ACK_POSTS[kind]).split('{player}').join(playerUsername).split('{detail}').join(detail)
}

export function secretPost(rng: RNG): string {
  return pick(rng, SECRET_POSTS)
}
