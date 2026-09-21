// Core domain types. Source of truth for the whole app — see PROJECT_SPEC.md section 6.

export type Persona =
  | 'loyal_fan'
  | 'hater'
  | 'rival'
  | 'teammate'
  | 'coach'
  | 'agent'
  | 'meme_account'
  | 'match_reporter'
  | 'insider'
  | 'tabloid'

export interface Avatar {
  kind: 'initials' | 'svg' | 'webp'
  value: string
}

export interface Profile {
  id: string
  username: string // without '@'
  displayName: string
  bio: string
  avatar: Avatar
  verified: boolean
  followers: number
  following: number
  joinedAt: number
  isPlayer: boolean
  // Captions the profile page's follower count with what most recently
  // moved it — same idea as PlayerState.lastHumorChange/NPC's own
  // lastRelationshipChange, only ever populated for the player's profile.
  lastFollowerChange?: { delta: number; reason: string; at: number }
}

export type RelationshipVibe =
  | 'friend'
  | 'rival'
  | 'mentor'
  | 'teammate_bond'
  | 'fan'
  | 'romantic'
  | 'frenemy'

export interface NPC extends Profile {
  persona: Persona
  personality: string[] // ['sarcastic','loyal']
  relationship: number // -100..100 with the player
  vibe: RelationshipVibe // see PROJECT_SPEC.md section 17.5 "Relationship vibes"
  mood: number // -10..10
  postingStyle: { emoji: number; caps: number; hashtags: number }
  recentLineIds: string[] // anti-repetition ring buffer
  dialogueState?: string // DM state machine node id
  followedByPlayer: boolean // player-controlled; not spec section 6 verbatim but required to persist follow state
  custom?: boolean // player-created via Settings > People, as opposed to career-pack seeded — only these can be deleted
  lastRelationshipChange?: { delta: number; reason: string; at: number } // shown as a caption on the relationship list
}

export type PostOrigin = 'template' | 'ai' | 'player'

// Section 4.3 "Composer": free text only — no post-type/tone picker. Tags
// come entirely from the keyword tagger; Tone stays declared for a possible
// future AI-inferred-tone feature but nothing sets it today.
export type Tone = 'humble' | 'cocky' | 'emotional' | 'funny'

export interface Post {
  id: string
  authorId: string
  kind: 'post' | 'reply' | 'story'
  parentId?: string // for replies
  text: string
  tags: string[]
  eventId?: string
  createdAt: number
  expiresAt?: number // stories
  likes: number
  reposts: number
  replies: number
  likedByPlayer?: boolean
  origin: PostOrigin
}

export interface DMMessage {
  id: string
  from: 'player' | 'npc'
  text: string
  at: number
  origin: PostOrigin
}

export interface DMThread {
  id: string
  npcId: string
  messages: DMMessage[]
  summary?: string // rolling summary of older messages for AI context
  unread: number
}

// The career the player picked at onboarding. Everything content-side (NPC
// roster, keyword tagger, reaction pools, stat names) comes from that
// career's CareerPack — see src/content/careers. Extensible: add a value
// here and a matching pack to add a new career.
export type CareerType = 'footballer' | 'rapper' | 'singer' | 'baseball_player'

export interface PlayerState {
  profileId: string
  career: CareerType
  club: string // the player's org — a club, label, or team depending on career
  position: string // the player's role within that org
  ratings: Record<string, number> // career-specific stat keys, e.g. finishing/passing or vocals/stage_presence
  traits: string[] // 'selfish','team_player','controversial'
  // Social stats — see PROJECT_SPEC.md section 17.5 "Outcome banner + stat deltas"
  humor: number // gained from posts that land as funny
  aura: number // gained from posts that land as confident/iconic
  // Captions the profile page's stat bars with what most recently moved
  // them — same idea as NPC.lastRelationshipChange, just for the player's
  // own Humor/Aura.
  lastHumorChange?: { delta: number; reason: string; at: number }
  lastAuraChange?: { delta: number; reason: string; at: number }
  xp: number
}

export interface Effect {
  type: 'mood' | 'relationship' | 'followers' | 'stat'
  target?: string // npc id for relationship/mood, stat name for stat
  delta: number
}

export interface SceneChoice {
  label: string
  effects: Effect[]
  tagsAdded: string[]
  roll?: { stat: string; difficulty: number; onFail?: string }
  next: string | 'end'
}

export interface Beat {
  id: string
  text: string
  choices: SceneChoice[]
}

export type SceneTemplate = 'match' | 'party' | 'press_conf' | 'negotiation'

export interface Scene {
  id: string
  template: SceneTemplate
  setup: Record<string, string> // opponent, venue, invitees...
  beats: Beat[]
}

export type ScheduledItemKind = 'post' | 'comment' | 'dm' | 'story_expiry' | 'event' | 'npc_story' | 'activity_start'

export interface ScheduledItem {
  id: string
  dueAt: number
  kind: ScheduledItemKind
  payload: unknown
}

export type GameEventType =
  | 'player_post'
  | 'player_story'
  | 'player_reply'
  | 'match_performance'
  | 'party'
  | 'press_conf'
  | 'negotiation'
  | 'injury'
  | 'transfer_rumor'
  | 'scandal_leak'
  | 'activity'

export interface GameEvent {
  id: string
  type: GameEventType
  tags: string[] // ['goals','hat_trick','derby','selfish']
  data: Record<string, unknown> // { goals, opponent, minute, ... }
  tone?: Tone
  sourceId?: string // post/scene that caused it
  timestamp: number // game time
}

export type AIStatus = 'on' | 'limited' | 'off'

// Never persisted in SaveGame — see src/ai/keyStorage.ts. The key lives in
// localStorage only, on this device, so it can never leak through IndexedDB
// exports or save-file sharing. See PROJECT_SPEC.md section 8 "Key handling".
export interface AIProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  rpmBudget: number
  rpdBudget: number
}

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  aiEnabled: boolean
  activeProviderId?: string
}

// Section 17.5 "Activity log": one entry per player action, with the exact
// stat deltas it caused, so the player can always see cause and effect.
export interface ActivityLogEntry {
  id: string
  at: number
  action: string // short machine-readable label, e.g. 'post', 'like', 'follow'
  eventId?: string // the GameEvent this action produced, if any
  deltas: Effect[]
  summary: string // one-line human-readable description
}

// Section 17.5 "Rewind / undo": a lightweight, reversible patch taken before
// a player action, not a full SaveGame snapshot (keeps iPhone memory use low).
export interface UndoSnapshot {
  id: string
  at: number
  activityLogEntryId: string
  inversePatch: Record<string, unknown> // applied to revert the action's effects
  scheduledItemIdsToRemove: string[] // ScheduledItems created by the undone action
}

export type ProactivityLevel = 'off' | 'low' | 'medium' | 'high'

// Section 17.5 "Madness scale" + "Proactive NPCs".
export interface WorldSettings {
  madness: number // 0 (grounded/realistic) .. 4 (absurd)
  proactivity: ProactivityLevel
}

// "Activities" — player-authored scenes with one or more NPCs (section 4.7
// "Event scenes" / 17.5 "Scheduled activities", built as a free-text setup
// instead of fixed templates). Not to be confused with ActivityLogEntry
// (the read-only history of past actions) above.
export type ActivityStatus = 'scheduled' | 'active' | 'ended'

export interface ActivityMessage {
  id: string
  from: 'player' | 'narrator'
  text: string
  at: number
  origin: PostOrigin
}

export interface Activity {
  id: string
  description: string // the player's free-text setup, e.g. "Dinner date with Jamie tonight"
  participantIds: string[] // NPCs present
  status: ActivityStatus
  startAt: number // set at creation; purely informational now — activities never auto-start
  plannedLabel?: string // "Now" / "Tonight" / etc, shown on the card until started
  createdAt: number
  messages: ActivityMessage[]
  turnCount: number // player choices/messages so far — caps how long a scene runs
  tags: string[] // from the keyword tagger on `description`; feeds relationship/coverage effects
  endedAt?: number
  outcomeSummary?: string
  // The current round of "what will you do" options offered to the player —
  // refreshed after every narrator beat (see advanceActivity). Player can
  // always ignore these and type their own move instead.
  pendingChoices: string[]
}

export interface SaveGame {
  version: number // for migrations
  clock: number
  player: PlayerState
  profiles: Record<string, Profile | NPC>
  posts: Record<string, Post>
  threads: Record<string, DMThread>
  scheduled: ScheduledItem[]
  settings: Settings
  activityLog: ActivityLogEntry[]
  undoStack: UndoSnapshot[]
  worldSettings: WorldSettings
  achievements: string[] // unlocked achievement ids
  mutedAccounts: string[] // profile ids muted by the player (stories, media posts)
  activities: Record<string, Activity>
  onboarded: boolean // has the player completed career/profile creation?
}

export function isNPC(profile: Profile | NPC): profile is NPC {
  return !profile.isPlayer && 'persona' in profile
}
