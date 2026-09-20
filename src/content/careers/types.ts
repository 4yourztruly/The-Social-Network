import type { NPC, Persona } from '../../types'

// A "career pack" is everything that makes the game feel like it's about a
// footballer vs. a rapper vs. a singer vs. a baseball player: the roster,
// the flavor text, the words that get tagged, the stat names. The engine
// (reaction rules, formulas, scheduler) never hard-codes any of this — it
// only knows canonical tags (see rules.ts) that every pack must emit.

export interface KeywordRule {
  tag: string
  patterns: RegExp[]
}

export interface ReactionPool {
  generic: string[]
  byTag: Record<string, string[]>
}

export type NPCSeed = Pick<
  NPC,
  'id' | 'username' | 'displayName' | 'bio' | 'persona' | 'personality' | 'verified' | 'followers' | 'following' | 'postingStyle'
>

export interface CareerPack {
  id: 'footballer' | 'rapper' | 'singer' | 'baseball_player'
  label: string // "Footballer"
  emoji: string
  roleOptions: string[] // choices offered at onboarding, e.g. ['Forward','Midfielder',...]
  orgLabel: string // "Club" | "Label" | "Team"
  worldName: string // fictional org the player starts at
  rivalWorldName: string
  ratingKeys: string[] // snake_case stat keys, e.g. ['finishing','passing',...]
  defaultRatings: Record<string, number>
  bioTemplate: (role: string, org: string) => string
  npcs: NPCSeed[]
  seedPostPool: Record<Persona, string[]>
  reactionPool: Record<Persona, ReactionPool>
  keywordRules: KeywordRule[]
}
