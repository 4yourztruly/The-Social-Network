import type { ReactionPool } from './careers/types'

// Career-agnostic filler used ONLY for an NPC.offTopic celeb — a real
// public figure the AI roster generator picked for variety who has nothing
// to do with this career's world (an actor in a footballer game, say).
// Every deterministic template call site (seed-time posts/replies, and the
// live reaction engine's fallback) checks offTopic and substitutes this
// instead of the career pack's sport/industry-flavored pools, so that
// person never gets stuck talking like a footballer/rapper/etc when AI
// isn't available for a given line.

export const GENERIC_OFFTOPIC_POSTS: string[] = [
  'Good day today.',
  'Grateful for everything right now.',
  "Can't complain, honestly.",
  'Busy week — more soon.',
  'Just living my life these days.',
  'Love to see it.',
  'Feeling good about where things are at.',
  'Quiet one today.',
]

export const GENERIC_OFFTOPIC_REACTION_POOL: ReactionPool = {
  generic: ['love this', 'so real', 'this is great', 'need this energy', 'obsessed', 'yes!! 🙌', 'incredible', 'here for this'],
  byTag: {},
}
