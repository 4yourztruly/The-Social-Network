import { z } from 'zod'

// Validates hand-authored content data at load time so a typo in content.ts
// fails fast instead of producing a broken profile deep in the feed.

export const personaSchema = z.enum([
  'loyal_fan',
  'hater',
  'rival',
  'teammate',
  'coach',
  'agent',
  'meme_account',
  'match_reporter',
  'insider',
  'tabloid',
])

export const npcSeedSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  bio: z.string(),
  persona: personaSchema,
  personality: z.array(z.string()),
  verified: z.boolean(),
  followers: z.number().int().nonnegative(),
  following: z.number().int().nonnegative(),
  postingStyle: z.object({
    emoji: z.number().min(0).max(1),
    caps: z.number().min(0).max(1),
    hashtags: z.number().min(0).max(1),
  }),
  avatar: z.object({ kind: z.enum(['initials', 'svg', 'webp']), value: z.string() }).optional(),
  offTopic: z.boolean().optional(),
})
export type NPCSeed = z.infer<typeof npcSeedSchema>

export const postPoolSchema = z.record(personaSchema, z.array(z.string()))
export type PostPool = z.infer<typeof postPoolSchema>

const reactionPoolEntrySchema = z.object({
  generic: z.array(z.string()),
  byTag: z.record(z.string(), z.array(z.string())),
})
export const reactionPoolSchema = z.record(personaSchema, reactionPoolEntrySchema)
