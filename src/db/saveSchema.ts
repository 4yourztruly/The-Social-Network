import { z } from 'zod'
import { personaSchema } from '../content/schemas'

// Validates imported save files before they touch the store. Deliberately a
// little looser than the TS types (e.g. Record<string, unknown> for data
// blobs) since the goal is "reject garbage", not re-derive the type system.

const avatarSchema = z.object({
  kind: z.enum(['initials', 'svg', 'webp']),
  value: z.string(),
})

const profileFields = {
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  bio: z.string(),
  avatar: avatarSchema,
  verified: z.boolean(),
  followers: z.number(),
  following: z.number(),
  joinedAt: z.number(),
  isPlayer: z.boolean(),
  lastFollowerChange: z.object({ delta: z.number(), reason: z.string(), at: z.number() }).optional(),
  bannerImage: z.string().optional(),
}

// .strict() matters here: z.object() by default *strips* unrecognized keys
// and still succeeds, so a non-strict profileSchema would happily "match" an
// NPC object too (silently dropping persona/vibe/relationship/etc from the
// result). That made the profiles union below pick profileSchema for NPCs
// whenever it was tried first, since it never actually failed — see the
// union's own comment.
const profileSchema = z.object(profileFields).strict()

const relationshipVibeSchema = z.enum([
  'friend',
  'rival',
  'mentor',
  'teammate_bond',
  'fan',
  'romantic',
  'frenemy',
])

const npcSchema = z.object({
  ...profileFields,
  persona: personaSchema,
  personality: z.array(z.string()),
  relationship: z.number(),
  vibe: relationshipVibeSchema,
  mood: z.number(),
  postingStyle: z.object({ emoji: z.number(), caps: z.number(), hashtags: z.number() }),
  recentLineIds: z.array(z.string()),
  dialogueState: z.string().optional(),
  followedByPlayer: z.boolean(),
  custom: z.boolean().optional(),
  lastRelationshipChange: z
    .object({ delta: z.number(), reason: z.string(), at: z.number() })
    .optional(),
})

const postSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  kind: z.enum(['post', 'reply', 'story']),
  parentId: z.string().optional(),
  text: z.string(),
  tags: z.array(z.string()),
  eventId: z.string().optional(),
  createdAt: z.number(),
  expiresAt: z.number().optional(),
  likes: z.number(),
  reposts: z.number(),
  replies: z.number(),
  likedByPlayer: z.boolean().optional(),
  origin: z.enum(['template', 'ai', 'player']),
})

const dmMessageSchema = z.object({
  id: z.string(),
  from: z.enum(['player', 'npc']),
  text: z.string(),
  at: z.number(),
  origin: z.enum(['template', 'ai', 'player']),
})

const dmThreadSchema = z.object({
  id: z.string(),
  npcId: z.string(),
  messages: z.array(dmMessageSchema),
  summary: z.string().optional(),
  unread: z.number(),
})

const careerTypeSchema = z.enum(['footballer', 'rapper', 'singer', 'baseball_player'])

const playerStateSchema = z.object({
  profileId: z.string(),
  career: careerTypeSchema,
  club: z.string(),
  position: z.string(),
  ratings: z.record(z.string(), z.number()),
  traits: z.array(z.string()),
  humor: z.number(),
  aura: z.number(),
  lastHumorChange: z.object({ delta: z.number(), reason: z.string(), at: z.number() }).optional(),
  lastAuraChange: z.object({ delta: z.number(), reason: z.string(), at: z.number() }).optional(),
  xp: z.number(),
})

const scheduledItemSchema = z.object({
  id: z.string(),
  dueAt: z.number(),
  kind: z.enum(['post', 'comment', 'dm', 'story_expiry', 'event', 'npc_story', 'activity_start']),
  payload: z.unknown(),
})

const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  aiEnabled: z.boolean(),
  activeProviderId: z.string().optional(),
})

const effectSchema = z.object({
  type: z.enum(['mood', 'relationship', 'followers', 'stat']),
  target: z.string().optional(),
  delta: z.number(),
})

const activityLogEntrySchema = z.object({
  id: z.string(),
  at: z.number(),
  action: z.string(),
  eventId: z.string().optional(),
  deltas: z.array(effectSchema),
  summary: z.string(),
})

const undoSnapshotSchema = z.object({
  id: z.string(),
  at: z.number(),
  activityLogEntryId: z.string(),
  inversePatch: z.record(z.string(), z.unknown()),
  scheduledItemIdsToRemove: z.array(z.string()),
})

const worldSettingsSchema = z.object({
  madness: z.number(),
  proactivity: z.enum(['off', 'low', 'medium', 'high']),
})

const activityMessageSchema = z.object({
  id: z.string(),
  from: z.enum(['player', 'narrator']),
  text: z.string(),
  at: z.number(),
  origin: z.enum(['template', 'ai', 'player']),
})

const activitySchema = z.object({
  id: z.string(),
  description: z.string(),
  participantIds: z.array(z.string()),
  status: z.enum(['scheduled', 'active', 'ended']),
  startAt: z.number(),
  plannedLabel: z.string().optional(),
  createdAt: z.number(),
  messages: z.array(activityMessageSchema),
  turnCount: z.number(),
  tags: z.array(z.string()),
  endedAt: z.number().optional(),
  outcomeSummary: z.string().optional(),
  pendingChoices: z.array(z.string()).default([]),
  rsvps: z.record(z.string(), z.enum(['accepted', 'declined'])).optional(),
})

export const saveGameSchema = z.object({
  version: z.number(),
  clock: z.number(),
  gameDay: z.number().int().positive().default(1),
  player: playerStateSchema,
  // npcSchema first: it's the strictly larger/more specific shape, so trying
  // it first (on top of profileSchema now being .strict()) means an NPC
  // never gets silently mis-matched against the plain Profile schema and
  // stripped of persona/vibe/relationship/followedByPlayer/etc — the exact
  // bug that made every NPC quietly stop being recognized as an NPC (People
  // list empty, Follow/DM broken) after the save round-tripped through
  // IndexedDB once.
  profiles: z.record(z.string(), z.union([npcSchema, profileSchema])),
  posts: z.record(z.string(), postSchema),
  threads: z.record(z.string(), dmThreadSchema),
  scheduled: z.array(scheduledItemSchema),
  settings: settingsSchema,
  activityLog: z.array(activityLogEntrySchema),
  undoStack: z.array(undoSnapshotSchema),
  worldSettings: worldSettingsSchema,
  achievements: z.array(z.string()),
  mutedAccounts: z.array(z.string()),
  activities: z.record(z.string(), activitySchema),
  onboarded: z.boolean(),
})
