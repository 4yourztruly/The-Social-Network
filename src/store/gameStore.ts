import { create } from 'zustand'
import type {
  Activity,
  ActivityMessage,
  ActivityLogEntry,
  Avatar,
  DMMessage,
  DMThread,
  Effect,
  NPC,
  PlayerState,
  Post,
  Profile,
  SaveGame,
  ScheduledItem,
  Settings,
  UndoSnapshot,
  WorldSettings,
} from '../types'
import {
  createSeededWorld,
  defaultSettings,
  defaultVibeForPersona,
  defaultWorldSettings,
  initialsFor,
  PLAYER_ID,
  seedDailyPosts,
  NPC_SOCIAL_SCORE,
  seedReplies,
  type OnboardingInput,
} from '../content/seed'
import { inferPersonaFromBio } from '../engine/personaInference'
import { canMessageFirst, isDmAvailable, isFollowable, isViewableProfile, tierForPersona } from '../engine/npcTier'
import { CAREER_PACKS } from '../content/careers'
import type { NPCSeed } from '../content/careers/types'
import { buildFallbackRoster } from '../content/rosterFallback'
import { generateRoster } from '../ai/rosterService'
import { buildCelebSeeds } from '../ai/celebSeedService'
import { buildFixedMediaSeeds } from '../content/universe'
import { generateAiSeedPost } from '../ai/seedContentService'
import { isNPC } from '../types'
import { resolvePublicity } from '../engine/publicity'
import type { WorldStory } from '../types'
import { fetchWikipediaFacts } from '../engine/wikiFacts'
import { padCelebs } from '../content/celebPool'
import { registerMemorySource } from '../engine/npcMemory'
import { acknowledgementPost, secretPost, specificCelebPost } from '../engine/specificContent'
import { makeId } from '../engine/id'
import { hashStringToSeed, mulberry32, pick, randomInt } from '../engine/rng'
import { createGameEvent } from '../engine/events'
import { applyPlayerEffects, lastStatChangesFromEffects, xpFromEffects } from '../engine/effects'
import { estimateEngagement, estimateReplyEngagement, statDeltasForTags, storyCommentCount } from '../engine/formulas'
import { explainStatDeltas, type OutcomeDetails } from '../engine/reportDetails'
import {
  gossipCommentText,
  gossipFacts,
  tabloidPostText,
  type CommentTarget,
  type GossipSubject,
} from '../engine/gossip'
import { splitDueItems } from '../engine/scheduler'
import {
  runReactionEngine,
  runSocialCircleEngine,
  ODD_CELEBRITY_CHANCE,
  SOCIAL_CIRCLE_MAX,
  type CommentPayload,
  type ScheduledCommentItem,
} from '../engine/reactions/engine'
import { scanKeywordTags } from '../engine/keywordTagger'
import { funMarkerTags } from '../engine/funMarkers'
import { generateDmReply, openingDmText, type DMSchedulePayload } from '../engine/dm'
import { buildUsernameIndex, extractMentionedIds } from '../engine/mentions'
import { fillTemplate } from '../engine/templates/filler'
import { pushRecentLine, selectLine } from '../engine/templates/select'
import { applyPersonalityVoice } from '../engine/voice'
import {
  ACTIVITY_CHOICES,
  ACTIVITY_TURN_CAP,
  computeRsvp,
  pickMediaOutlet,
  templatedActivityBeat,
  templatedActivityClosing,
  templatedActivityOpening,
  type RsvpDecision,
} from '../engine/activity'
import {
  outcomeText,
  pickPrompt,
  rollTier,
  tierOutcome,
  type EncounterChoice,
  type EncounterTier,
} from '../engine/randomEncounter'
import { msUntilNextEvent, recordEventTriggered } from '../engine/eventCooldown'
import { generateAiDmReply } from '../ai/dmService'
import { generateAiCommentBatch, generateAiDailyPosts, MAX_BATCH_ITEMS, type BatchCommentItem } from '../ai/batchService'
import { generateActivityTurn, generateMediaCoverage } from '../ai/activityService'
import { generateAiEncounter, generateAiEncounterOutcome } from '../ai/eventService'
import { getProviderConfig, loadProviderConfigs } from '../ai/keyStorage'
import { GENERIC_OFFTOPIC_REACTION_POOL } from '../content/genericFiller'
import { canSpend, recordSpend } from '../ai/budget'

const STORY_TTL_MS = 24 * 60 * 60 * 1000

// Where each open DM thread stood when the player opened it — see finishDmSession.
const dmSessionStart = new Map<string, number>()

export const SAVE_VERSION = 6

export interface RelationshipChangeSummary {
  npcId: string
  delta: number
}

// The "report card" shown after posting, ending an activity, or resolving
// an event — see components/OutcomeBanner.tsx. Set reactively on
// GameState.lastOutcomeReport rather than returned from the triggering
// action, since an activity/event's outcome can resolve asynchronously
// (AI narration) well after the action call itself returns.
export interface OutcomeReport {
  kind: 'post' | 'activity' | 'event' | 'comment' | 'story' | 'dm'
  xpGained: number
  statDeltas: Effect[]
  followerDelta: number
  relationshipChanges: RelationshipChangeSummary[]
  reason?: string
  commentCount?: number
  // The expanded report card (tap the card): why things moved, relationship
  // status now, and what the tabloids did with it.
  details?: OutcomeDetails
}

// The "Event" button's random encounter — ephemeral, not part of SaveGame
// (like aiTyping): a single quick decision, resolved instantly, unlike the
// player-authored, multi-turn Activities above.
export interface RandomEncounter {
  id: string
  text: string
  loading: boolean // true while the AI situation/outcome call is in flight
  celebId?: string
  choices: EncounterChoice[]
  pendingChoiceLabel?: string // set while resolving, so the UI can show what was picked during the wait
  resolution?: {
    text: string
    tier: EncounterTier
    statDeltas: Effect[]
    followerDelta: number
  }
}

// Bootstrap default so the store always has a valid shape before onboarding
// completes. Never shown to the player — App.tsx gates all screens on
// `onboarded` and renders the Onboarding flow instead.
const BOOTSTRAP_INPUT: OnboardingInput = {
  career: 'footballer',
  displayName: 'New Player',
  username: 'newplayer',
  role: '',
  org: '',
}

export interface GameState {
  clock: number
  // In-game "Day" counter shown in the header — advances once a player
  // action actually concludes (a post is submitted, an activity ends, an
  // event is resolved), never mid-action, and never on real wall-clock
  // time. Each advance also drops a small batch of fresh NPC posts into
  // the feed — see advanceDay().
  gameDay: number
  player: PlayerState
  profiles: Record<string, Profile | NPC>
  posts: Record<string, Post>
  postOrder: string[] // post ids, newest first
  threads: Record<string, DMThread> // keyed by npcId — one thread per NPC
  aiTyping: string[] // npcIds with an AI reply in flight — not persisted, purely a UI signal
  scheduled: ScheduledItem[]
  settings: Settings
  activityLog: ActivityLogEntry[]
  undoStack: UndoSnapshot[]
  worldSettings: WorldSettings
  achievements: string[]
  mutedAccounts: string[]
  worldStories: WorldStory[]
  activities: Record<string, Activity>
  activeEncounter: RandomEncounter | null
  onboarded: boolean
  // The "report card" shown after posting/ending an activity/resolving an
  // event — see OutcomeReport. Reactive rather than a callback so an
  // activity/event's async (AI) outcome can still surface it once ready.
  lastOutcomeReport: OutcomeReport | null

  // onboarding
  completeOnboarding: (input: OnboardingInput) => Promise<void>

  // world actions
  followNpc: (npcId: string) => void
  unfollowNpc: (npcId: string) => void
  updatePlayerProfile: (patch: Partial<Pick<Profile, 'displayName' | 'bio' | 'avatar' | 'bannerImage'>>) => void
  muteAccount: (profileId: string) => void
  unmuteAccount: (profileId: string) => void

  // custom people (Settings > People)
  addCustomPerson: (input: AddCustomPersonInput) => string
  removeCustomPerson: (npcId: string) => void

  // feed actions
  toggleLike: (postId: string) => void
  submitPlayerPost: (input: { caption: string }) => void
  addPlayerReply: (parentId: string, text: string) => void
  submitPlayerStory: (caption: string) => void
  dismissOutcomeReport: () => void
  tickScheduler: (now?: number) => void

  // DMs
  sendPlayerMessage: (npcId: string, text: string) => void
  markThreadRead: (npcId: string) => void
  // A DM "session" is one visit to a thread: the report card comes when you leave it.
  beginDmSession: (npcId: string) => void
  finishDmSession: (npcId: string, sinceIndex?: number) => void

  // activities
  createActivity: (input: CreateActivityInput) => string
  startActivity: (activityId: string) => void
  deleteActivity: (activityId: string) => void
  sendActivityChoice: (activityId: string, text: string) => void
  endActivity: (activityId: string) => void

  // random events (the Event button)
  triggerRandomEncounter: () => boolean // false if still on cooldown
  resolveEncounterChoice: (choiceId: string) => void
  resolveEncounterCustom: (text: string) => void
  dismissEncounter: () => void

  // settings actions
  setTheme: (theme: Settings['theme']) => void
  setAiEnabled: (enabled: boolean) => void
  setActiveProviderId: (id: string | undefined) => void
  setWorldSettings: (patch: Partial<WorldSettings>) => void

  // persistence
  hydrateFromSave: (save: SaveGame) => void
  resetWorld: () => void
  toSaveGame: () => SaveGame
}

export interface AddCustomPersonInput {
  displayName: string
  username: string
  bio: string
  followers?: number
  avatar?: Avatar
  personality?: string[] // from AI enrichment (Settings > People > Fill with AI) — see ai/personService.ts
  verified?: boolean
}

export interface CreateActivityInput {
  description: string
  participantIds: string[]
  // Purely a "planned for" label (e.g. "Tonight") shown once created —
  // activities never auto-start; the player always taps Start explicitly.
  plannedLabel: string
}

function buildInitialState(input: OnboardingInput, npcSeeds?: NPCSeed[]) {
  const pack = CAREER_PACKS[input.career]
  const world = createSeededWorld(pack, input, Date.now(), npcSeeds)
  // Start the player following the celebrities they added to their universe
  // (and, for older saves' worlds, the org's own teammates + coach).
  for (const profile of Object.values(world.profiles)) {
    if (isNPC(profile) && (profile.persona === 'celebrity' || profile.persona === 'teammate' || profile.persona === 'coach')) {
      profile.followedByPlayer = true
    }
  }
  const followingCount = Object.values(world.profiles).filter(
    (p) => isNPC(p) && p.followedByPlayer,
  ).length
  ;(world.profiles[PLAYER_ID] as Profile).following = followingCount
  return { ...world, gameDay: 1 }
}

// New posts dropped into the feed each time the day advances.
const DAILY_POST_COUNT = 8

// At most this many of the celeb tier's opening posts get personalized via
// AI at onboarding — see completeOnboarding. Capped to keep the one-time
// onboarding cost predictable regardless of roster size.
const MAX_AI_SEED_POSTS = 6

export const useGameStore = create<GameState>((set, get) => {
  // Advances the in-game "Day" counter and drops a fresh batch of NPC posts
  // (plus their replies) into the feed — called once an action actually
  // concludes: a post submitted, an activity ended, an event resolved.
  // Deliberately NOT called when one merely starts (starting an activity,
  // triggering an event) — the day shouldn't tick over mid-action, only
  // once it's actually done. Not tied to real wall-clock time at all.
  // Every comment already sitting under a story, so a new story's comment
  // section doesn't repeat them.
  function existingStoryCommentTexts(posts: Record<string, Post>): Set<string> {
    const storyIds = new Set(Object.values(posts).filter((p) => p.kind === 'story').map((p) => p.id))
    return new Set(Object.values(posts).filter((p) => p.parentId && storyIds.has(p.parentId)).map((p) => p.text))
  }

  function aiConfigNow(): NonNullable<ReturnType<typeof getProviderConfig>> | undefined {
    const st = get()
    if (!st.settings.aiEnabled) return undefined
    const config = getProviderConfig(st.settings.activeProviderId)
    return config && canSpend(config.id, config.rpdBudget) ? config : undefined
  }

  registerMemorySource(() => {
    const st = get()
    return {
      playerName: (st.profiles[PLAYER_ID] as Profile).displayName,
      activities: st.activities,
      threads: st.threads,
      posts: st.posts,
      profiles: st.profiles,
      worldStories: st.worldStories,
    }
  })

  const MAX_THREAD_DEPTH = 2

  interface PlannedComment {
    parent: Post
    npc: NPC
    // Index in the plan of the comment this one answers, if any.
    replyTo?: number
  }

  // Fills posts/stories with AI-written comment threads — top-level
  // comments plus replies and replies-to-replies — in as few requests as
  // possible (one per ~40 comments; a whole thread always lands in one
  // request). `countFor` is the total comments a post should get. Returns
  // false when AI wasn't available or the call failed outright, so the
  // caller can fall back to templates.
  async function aiPopulateComments(parents: Post[], countFor: (p: Post) => number): Promise<boolean> {
    const config = aiConfigNow()
    if (!config || parents.length === 0) return false
    const state = get()
    const pool = Object.values(state.profiles)
      .filter(isNPC)
      .filter((n) => tierForPersona(n.persona) !== 'media')
    if (pool.length === 0) return false
    const rng = mulberry32(hashStringToSeed(`aicomments_${state.clock}_${parents.length}_${Date.now()}`))

    const plan: PlannedComment[] = []
    const chunkStarts: number[] = []
    for (const parent of parents) {
      const eligible = pool.filter((c) => c.id !== parent.authorId).sort(() => rng() - 0.5)
      if (eligible.length === 0) continue
      const n = Math.max(1, countFor(parent))
      const base = plan.length
      if (plan.length - (chunkStarts.at(-1) ?? 0) + n > MAX_BATCH_ITEMS || chunkStarts.length === 0) chunkStarts.push(base)
      const depths: number[] = []
      for (let k = 0; k < n; k++) {
        let replyTo: number | undefined
        if (k >= 2 && rng() < 0.45) {
          const candidates = depths.map((d, i) => ({ d, i })).filter((c) => c.d < MAX_THREAD_DEPTH)
          if (candidates.length > 0) replyTo = base + pick(rng, candidates).i
        }
        let npc = eligible[k % eligible.length]
        // Never answer yourself.
        if (replyTo !== undefined && plan[replyTo].npc.id === npc.id) npc = eligible[(k + 1) % eligible.length]
        depths.push(replyTo === undefined ? 0 : depths[replyTo - base] + 1)
        plan.push({ parent, npc, replyTo })
      }
    }
    if (plan.length === 0) return false

    const playerProfile = state.profiles[PLAYER_ID] as Profile
    const pack = CAREER_PACKS[state.player.career]
    const ids: (string | undefined)[] = new Array(plan.length)
    let anySucceeded = false
    for (let c = 0; c < chunkStarts.length; c++) {
      const start = chunkStarts[c]
      const end = chunkStarts[c + 1] ?? plan.length
      const chunk = plan.slice(start, end)
      const texts = await generateAiCommentBatch({
        items: chunk.map(({ parent, npc, replyTo }) => ({
          npc,
          targetText: parent.text,
          targetAuthorName: get().profiles[parent.authorId]?.displayName ?? 'someone',
          targetIsPlayer: parent.authorId === PLAYER_ID,
          targetIsReply: false,
          parentItem: replyTo === undefined ? undefined : replyTo - start,
        })),
        playerDisplayName: playerProfile.displayName,
        orgName: state.player.club || pack.worldName,
        recentActivity: state.activityLog,
        config,
      })
      if (!texts) continue
      anySucceeded = true
      recordSpend(config.id)

      const replies: Post[] = []
      const bump = new Map<string, number>()
      for (let i = 0; i < chunk.length; i++) {
        const text = texts.get(i)
        if (!text) continue
        const { parent, npc, replyTo } = chunk[i]
        const parentCommentId = replyTo !== undefined ? ids[replyTo] : undefined
        const parentComment = parentCommentId ? replies.find((r) => r.id === parentCommentId) : undefined
        const id = makeId('post')
        ids[start + i] = id
        const engagement = estimateReplyEngagement(mulberry32(hashStringToSeed(`${id}_engagement`)), npc.followers, NPC_SOCIAL_SCORE)
        const mention = parentComment ? state.profiles[parentComment.authorId]?.username : undefined
        replies.push({
          id,
          authorId: npc.id,
          kind: 'reply',
          parentId: parentComment ? parentComment.id : parent.id,
          text: mention && !text.trim().startsWith('@') ? `@${mention} ${text}` : text,
          tags: [],
          createdAt: Math.min(
            Date.now(),
            (parentComment?.createdAt ?? parent.createdAt) + randomInt(rng, 1, 90) * 60 * 1000,
          ),
          likes: engagement.likes,
          reposts: engagement.reposts,
          replies: 0,
          origin: 'ai',
        })
        bump.set(parent.id, (bump.get(parent.id) ?? 0) + 1)
        if (parentComment) bump.set(parentComment.id, (bump.get(parentComment.id) ?? 0) + 1)
      }
      set((st) => {
        const posts = { ...st.posts }
        for (const r of replies) posts[r.id] = r
        for (const [pid, n] of bump) if (posts[pid]) posts[pid] = { ...posts[pid], replies: posts[pid].replies + n }
        return { posts, postOrder: [...replies.map((r) => r.id), ...st.postOrder] }
      })
    }
    return anySucceeded
  }

  // The deterministic fallback for the above: canned reactions, sized by
  // each parent's original reply count.
  function addTemplateReplies(parents: Post[], counts: Record<string, number>) {
    const state = get()
    const pack = CAREER_PACKS[state.player.career]
    const npcRecord: Record<string, NPC> = {}
    for (const p of Object.values(state.profiles)) if (isNPC(p)) npcRecord[p.id] = p
    const withCounts = parents.map((p) => ({ ...p, replies: counts[p.id] ?? 0 }))
    const rng = mulberry32(hashStringToSeed(`tplreplies_${state.clock}_${parents.length}`))
    const replies = seedReplies(pack, rng, npcRecord, withCounts, state.player.club || pack.worldName)
    set((st) => {
      const posts = { ...st.posts }
      for (const r of replies) posts[r.id] = r
      const added = new Map<string, number>()
      for (const r of replies) if (r.parentId) added.set(r.parentId, (added.get(r.parentId) ?? 0) + 1)
      for (const [pid, n] of added) if (posts[pid]) posts[pid] = { ...posts[pid], replies: posts[pid].replies + n }
      return { posts, postOrder: [...replies.map((r) => r.id), ...st.postOrder] }
    })
  }

  interface DayHold {
    posts: Post[]
    replyCounts: Record<string, number>
    day: number
  }

  // AI mode's version of a new day: the day's posts are written by the AI
  // (one request) and their comments too (one more), instead of canned lines.
  // Any failure falls back to the templates for just that part.
  async function finishAiDay(hold: DayHold) {
    const config = aiConfigNow()
    const state = get()
    const pack = CAREER_PACKS[state.player.career]
    const playerUsername = state.profiles[PLAYER_ID]?.username
    let texts: Map<number, string> | null = null
    if (config) {
      texts = await generateAiDailyPosts({
        authors: hold.posts.map((p) => get().profiles[p.authorId] as NPC),
        worldName: pack.worldName,
        config,
      })
      if (texts) recordSpend(config.id)
    }
    const finalPosts = hold.posts
      .map((p, i) => {
      // The "public @-ing the player" post keeps its own text.
      const keep = !!playerUsername && p.text.includes(`@${playerUsername}`)
      const aiText = keep ? undefined : texts?.get(i)
      return { ...p, gameDay: hold.day, replies: 0, ...(aiText ? { text: aiText, origin: 'ai' as const } : {}) }
    })
      // A celeb with nothing specific to say (and no AI to say it) just doesn't post.
      .filter((p) => p.text.trim().length > 0)
    set((st) => {
      const posts = { ...st.posts }
      for (const p of finalPosts) posts[p.id] = p
      return { posts, postOrder: [...finalPosts.map((p) => p.id), ...st.postOrder] }
    })
    const ok = await aiPopulateComments(finalPosts, (p) => hold.replyCounts[p.id] ?? 8)
    if (!ok) addTemplateReplies(finalPosts, hold.replyCounts)
    else fillThinThreads(finalPosts, 6)
  }

  // No post is left with a near-empty comment section: anything under `min`
  // (a partly failed AI batch, a skipped parent) is topped up.
  function fillThinThreads(parents: Post[], min: number, target: (p: Post) => number = () => min) {
    const children = new Map<string, number>()
    for (const p of Object.values(get().posts)) if (p.parentId) children.set(p.parentId, (children.get(p.parentId) ?? 0) + 1)
    const thin = parents.filter((p) => (children.get(p.id) ?? 0) < min)
    if (thin.length === 0) return
    addTemplateReplies(
      thin,
      Object.fromEntries(thin.map((p) => [p.id, Math.max(min - (children.get(p.id) ?? 0), target(p) - (children.get(p.id) ?? 0))])),
    )
  }

  // A celeb answers the player publicly — their own post @-ing them, not just
  // a reply — when the player did something public that warrants it (defended
  // them, tagged them, shared a public moment with them). Or, when the two are
  // keeping something quiet, a coy hint with no names. See engine/specificContent.
  function celebResponds(args: {
    kind: 'reply' | 'activity' | 'event' | 'post' | 'story'
    npcIds: string[]
    detail: string
    chance: number
    secret?: boolean
  }) {
    const state = get()
    const player = state.profiles[PLAYER_ID] as Profile
    const rng = mulberry32(hashStringToSeed(`respond_${args.kind}_${Date.now()}_${args.detail}`))
    const candidates = args.npcIds
      .map((id) => state.profiles[id])
      .filter((n): n is NPC => !!n && isNPC(n))
      .filter((n) => tierForPersona(n.persona) === 'celeb' && n.relationship > -20)
    if (candidates.length === 0 || rng() > args.chance) return
    const npc = pick(rng, candidates)
    const shortDetail = args.detail.length > 60 ? `${args.detail.slice(0, 60)}…` : args.detail
    const fallback = args.secret ? secretPost(rng) : acknowledgementPost(rng, args.kind, player.username, shortDetail)
    const hint = args.secret
      ? `You and ${player.displayName} privately did this: "${shortDetail}". You are keeping it quiet — post a coy, vague hint (no names, no details) that only hints something happened.`
      : `${player.displayName} (@${player.username}) just did this publicly: "${shortDetail}". Post publicly acknowledging it and @-mention @${player.username}.`

    const publish = (text: string, origin: Post['origin']) => {
      const engagement = estimateEngagement(rng, npc.followers, NPC_SOCIAL_SCORE, [])
      const post: Post = {
        id: makeId('post'),
        authorId: npc.id,
        kind: 'post',
        text,
        tags: [],
        createdAt: Date.now(),
        gameDay: get().gameDay,
        likes: engagement.likes,
        reposts: engagement.reposts,
        replies: 0,
        origin,
      }
      set((st) => ({ posts: { ...st.posts, [post.id]: post }, postOrder: [post.id, ...st.postOrder] }))
      const count = randomInt(rng, 6, 10)
      void aiPopulateComments([post], () => count).then((ok) => {
        if (!ok) addTemplateReplies([post], { [post.id]: count })
        else fillThinThreads([post], 5)
      })
    }

    const config = aiConfigNow()
    if (!config) {
      publish(fallback, 'template')
      return
    }
    void generateAiDailyPosts({
      authors: [npc],
      hints: [hint],
      worldName: CAREER_PACKS[state.player.career].worldName,
      config,
    }).then((texts) => {
      if (texts) recordSpend(config.id)
      publish(texts?.get(0) ?? fallback, texts?.get(0) ? 'ai' : 'template')
    })
  }

  function advanceDay() {
    const hold: { day?: DayHold } = {}
    const aiOn = !!aiConfigNow()
    set((state) => {
      const pack = CAREER_PACKS[state.player.career]
      const npcs: Record<string, NPC> = {}
      for (const profile of Object.values(state.profiles)) {
        if (isNPC(profile)) npcs[profile.id] = profile
      }
      const rng = mulberry32(hashStringToSeed(`day_${state.gameDay}_${state.clock}_${Object.keys(state.posts).length}`))
      const orgForFlavor = state.player.club || pack.worldName
      // Usually a single post from the news outlets — more only when a lot
      // is going on: the last thing you did was an event, or it made news.
      const busy =
        (state.activityLog.at(-1)?.eventId ? 1 : 0) + ((state.lastOutcomeReport?.details?.signals.length ?? 0) > 0 ? 1 : 0)
      const dailyPosts = seedDailyPosts(pack, rng, npcs, DAILY_POST_COUNT, orgForFlavor, state.profiles[PLAYER_ID]?.username, 1 + busy, Math.max(2, 1 + busy), state.worldStories, aiOn)
      const nextGameDay = state.gameDay + 1
      if (aiOn) {
        // No canned posts/comments in AI mode — finishAiDay adds the AI's.
        hold.day = {
          posts: dailyPosts,
          replyCounts: Object.fromEntries(dailyPosts.map((p) => [p.id, p.replies])),
          day: nextGameDay,
        }
        return { gameDay: nextGameDay }
      }
      const dailyReplies = seedReplies(pack, rng, npcs, dailyPosts, orgForFlavor)
      const newItems = [...dailyPosts, ...dailyReplies].sort((a, b) => b.createdAt - a.createdAt)

      const posts = { ...state.posts }
      for (const post of newItems) {
        post.gameDay = nextGameDay
        posts[post.id] = post
      }

      return {
        gameDay: nextGameDay,
        posts,
        postOrder: [...newItems.map((p) => p.id), ...state.postOrder],
      }
    })
    celebOutreach()
    runWorldGossip()
    if (hold.day) void finishAiDay(hold.day)
  }

  const NEGATIVE_TAGS = ['controversial', 'criticism', 'scandal_leak', 'setback']

  // The smaller sibling of the post/activity/event report card, for
  // everything else the player does — a reply, a comment, a story, a chat.
  // Real (scaled-down) stat, follower and relationship effects, plus the same
  // expandable explanation, so no action goes unanswered.
  function lightActionReport(args: {
    kind: 'comment' | 'story' | 'dm'
    subject: 'reply' | 'story' | 'chat'
    text: string
    summary: string
    caption: string
    npcIds: string[]
    npcDelta: number
    scale: number
    followerBonus?: boolean
    buzz?: string
  }) {
    const state = get()
    const pack = CAREER_PACKS[state.player.career]
    const now = Date.now()
    const tags = [...scanKeywordTags(args.text, pack.keywordRules), ...funMarkerTags(args.text)]
    const rng = mulberry32(hashStringToSeed(`${args.kind}_${now}_${args.text}`))
    const negative = tags.some((t) => NEGATIVE_TAGS.includes(t))

    const statDeltas: Effect[] = statDeltasForTags(rng, tags)
      // A private chat never moves your public following.
      .filter((e) => args.kind !== 'dm' || e.type !== 'followers')
      .map((e) => ({ ...e, delta: Math.round(e.delta * args.scale) }))
      .filter((e) => e.delta !== 0)
    const playerProfile = state.profiles[PLAYER_ID] as Profile
    let followerDelta = statDeltas.filter((e) => e.type === 'followers').reduce((sum, e) => sum + e.delta, 0)
    if (args.followerBonus && !negative) followerDelta += Math.max(1, Math.round(playerProfile.followers * 0.001 * (0.5 + rng())))

    const statEffects = statDeltas.filter((e) => e.type === 'stat')
    const swing = statEffects.reduce((sum, e) => sum + Math.abs(e.delta), 0)
    const xp = 3 + swing * 2

    const npcDelta = negative ? -Math.abs(args.npcDelta) : args.npcDelta
    const profiles = { ...state.profiles }
    const relationshipChanges: RelationshipChangeSummary[] = []
    const relationships: OutcomeDetails['relationships'] = []
    for (const npcId of args.npcIds) {
      const npc = profiles[npcId]
      if (!npc || !isNPC(npc) || npcDelta === 0) continue
      const after = Math.max(-100, Math.min(100, npc.relationship + npcDelta))
      if (after === npc.relationship) continue
      profiles[npcId] = { ...npc, relationship: after, lastRelationshipChange: { delta: npcDelta, reason: args.caption, at: now } }
      relationshipChanges.push({ npcId, delta: npcDelta })
      relationships.push({
        npcId,
        delta: npcDelta,
        before: npc.relationship,
        after,
        reason: negative ? 'It came across as confrontational, which cooled things.' : 'Making the effort to engage warmed things up.',
      })
    }
    profiles[PLAYER_ID] = {
      ...playerProfile,
      followers: Math.max(0, playerProfile.followers + followerDelta),
      lastFollowerChange: followerDelta !== 0 ? { delta: followerDelta, reason: args.caption, at: now } : playerProfile.lastFollowerChange,
    }
    const nextPlayer = { ...state.player, xp: state.player.xp + xp }
    for (const e of statEffects) {
      if (e.target === 'humor' || e.target === 'aura') nextPlayer[e.target] = Math.max(0, Math.min(100, nextPlayer[e.target] + e.delta))
    }
    Object.assign(nextPlayer, lastStatChangesFromEffects(statEffects, args.caption, now))

    const report: OutcomeReport = {
      kind: args.kind,
      xpGained: xp,
      statDeltas,
      followerDelta,
      relationshipChanges,
      reason: args.caption,
      details: {
        summary: args.summary,
        statReasons: explainStatDeltas(tags, statDeltas, args.subject, 'People noticed and a few followed.', followerDelta),
        relationships,
        signals: tags,
        buzz: args.buzz,
      },
    }
    set({ profiles, player: nextPlayer, lastOutcomeReport: report })
  }

  const WORLD_PAIR_SCENES = [
    'a candlelit dinner date at a rooftop restaurant',
    'a wild night out at a club in the city',
    'a relaxed lunch catching up like old friends',
    'a charity gala where they kept close all evening',
    'a weekend beach getaway together',
    'a late-night drinks after a party',
  ]
  const WORLD_SOLO_SCENES = [
    'a shopping trip downtown that turned into a crowd',
    'a late-night airport arrival',
    'a film premiere red carpet',
    'a quiet coffee run that got photographed',
    'a gym session that went viral',
    'a family holiday abroad',
  ]

  // Not everything is about the player: now and then the tabloids run a
  // story about celebs in their own lives — two of them out together, or one
  // caught out alone — and the world reacts under their posts. Never on a
  // day the news outlet is already busy.
  function runWorldGossip() {
    const state = get()
    const celebs = Object.values(state.profiles)
      .filter(isNPC)
      .filter((n) => tierForPersona(n.persona) === 'celeb')
    if (celebs.length === 0) return
    const rng = mulberry32(hashStringToSeed(`world_${state.gameDay}_${state.clock}`))
    if (rng() > 0.4) return
    const outlet = pickMediaOutlet(Object.values(state.profiles).filter(isNPC))
    if (!outlet) return
    const outletToday = Object.values(state.posts).filter((p) => p.authorId === outlet.id && p.gameDay === state.gameDay).length
    if (outletToday >= 2) return

    const a = pick(rng, celebs)
    const others = celebs.filter((c) => c.id !== a.id)
    const b = others.length > 0 && rng() < 0.65 ? pick(rng, others) : undefined
    runGossip({
      kind: 'activity',
      playerName: a.displayName,
      detail: pick(rng, b ? WORLD_PAIR_SCENES : WORLD_SOLO_SCENES),
      tags: [],
      others: b ? [b.displayName] : [],
      world: true,
      subjectNpcId: a.id,
    })
  }

  // Looks the celebs up on Wikipedia (once each) so they, and the AI writing
  // as them, know what they're really known for. See engine/wikiFacts.ts.
  async function hydrateKnowledge() {
    const targets = Object.values(get().profiles)
      .filter(isNPC)
      .filter((n) => tierForPersona(n.persona) === 'celeb' && !n.knowledgeChecked)
      .slice(0, 20)
    if (targets.length === 0 || import.meta.env.MODE === 'test') return
    // One at a time with a short gap — Wikipedia rate-limits bursts.
    const results: { id: string; facts: string | null }[] = []
    for (const n of targets) {
      results.push({ id: n.id, facts: await fetchWikipediaFacts(n.displayName) })
      await new Promise((r) => setTimeout(r, 200))
    }
    set((st) => {
      const profiles = { ...st.profiles }
      for (const r of results) {
        const cur = profiles[r.id]
        if (cur && isNPC(cur)) profiles[r.id] = { ...cur, knowledge: r.facts ?? cur.knowledge, knowledgeChecked: true }
      }
      return { profiles }
    })
  }

  // Celebs the player is getting along with (relationship in the green, 25%+)
  // sometimes message first. At most a couple per day, never stacked on an
  // unanswered message, and never someone who can't be DMed at all.
  function celebOutreach() {
    const state = get()
    const playerName = (state.profiles[PLAYER_ID] as Profile).displayName
    const rng = mulberry32(hashStringToSeed(`outreach_${state.gameDay}_${state.clock}`))
    const eligible = Object.values(state.profiles)
      .filter(isNPC)
      .filter((n) => canMessageFirst(n) && isDmAvailable(n) && state.threads[n.id]?.messages.at(-1)?.from !== 'npc')
    if (eligible.length === 0) return
    const shuffled = [...eligible].sort(() => rng() - 0.5)
    const now = Date.now()
    const sends: { npc: NPC; text: string }[] = []
    for (const npc of shuffled) {
      if (sends.length >= 2) break
      if (rng() < 0.4) sends.push({ npc, text: openingDmText(rng, npc, playerName) })
    }
    if (sends.length === 0) return
    set((st) => {
      const threads = { ...st.threads }
      for (const { npc, text } of sends) {
        const msg: DMMessage = { id: makeId('msg'), from: 'npc', text, at: now, origin: 'template' }
        const existing = threads[npc.id]
        threads[npc.id] = existing
          ? { ...existing, messages: [...existing.messages, msg], unread: existing.unread + 1 }
          : { id: npc.id, npcId: npc.id, messages: [msg], unread: 1 }
      }
      return { threads }
    })
  }

  // Materializes an NPC's DM reply into its thread — shared by the
  // deterministic scheduler path (tickScheduler) and the AI path (which
  // resolves later, asynchronously, once the network call finishes).
  function appendNpcDmMessage(npcId: string, text: string, origin: DMMessage['origin']) {
    set((state) => {
      const thread = state.threads[npcId]
      if (!thread) return state
      const npcMsg: DMMessage = { id: makeId('msg'), from: 'npc', text, at: Date.now(), origin }
      return {
        threads: {
          ...state.threads,
          [npcId]: { ...thread, messages: [...thread.messages, npcMsg], unread: thread.unread + 1 },
        },
      }
    })
  }

  // Materializes one NPC comment under its parent post immediately — used
  // by processComments for both the deterministic path and the AI path
  // (once its network call resolves). If the payload names a
  // replyFromNpcId (see runSocialCircleEngine), also fires off exactly one
  // follow-up comment replying to THIS one, one level deep, right away —
  // its parent post id (this comment's own id) isn't known until now, which
  // is why that can't happen at post-creation time.
  function materializeComment(payload: CommentPayload, text: string, dueAt: number, origin: Post['origin']) {
    const commentPostId = makeId('post')
    let replyItem: ScheduledCommentItem | null = null

    set((state) => {
      const parent = state.posts[payload.parentPostId]
      if (!parent) return state
      // Replying to someone's comment (not the post/story itself) @-mentions
      // them, same as when the player replies.
      const replyTarget = parent.kind === 'reply' ? state.profiles[parent.authorId] : undefined
      if (replyTarget && !text.trim().startsWith('@')) text = `@${replyTarget.username} ${text}`
      const commenter = state.profiles[payload.npcId]
      const commentEngagement = estimateReplyEngagement(
        mulberry32(hashStringToSeed(`${commentPostId}_engagement`)),
        commenter?.followers ?? 0,
        (state.player.humor + state.player.aura) / 2,
      )
      const commentPost: Post = {
        id: commentPostId,
        authorId: payload.npcId,
        kind: 'reply',
        parentId: payload.parentPostId,
        text,
        tags: payload.tags,
        createdAt: dueAt,
        likes: commentEngagement.likes,
        reposts: commentEngagement.reposts,
        replies: 0,
        origin,
      }

      const posts = {
        ...state.posts,
        [commentPost.id]: commentPost,
        [parent.id]: { ...parent, replies: parent.replies + 1 },
      }
      let profiles = state.profiles

      const replier = payload.replyFromNpcId ? state.profiles[payload.replyFromNpcId] : undefined
      if (replier && isNPC(replier)) {
        const pack = CAREER_PACKS[state.player.career]
        const playerProfile = state.profiles[PLAYER_ID] as Profile
        const rng = mulberry32(hashStringToSeed(`${commentPostId}_reply`))
        const linePool = pack.reactionPool[replier.persona]
        const selection = selectLine(rng, linePool, payload.tags, replier.recentLineIds)
        const filled = fillTemplate(selection.line, {
          player: playerProfile.displayName,
          org: state.player.club || pack.worldName,
        })
        const fallbackText = applyPersonalityVoice(filled, replier, rng)
        profiles = {
          ...profiles,
          [replier.id]: { ...replier, recentLineIds: pushRecentLine(replier.recentLineIds, selection.lineId) },
        }
        replyItem = {
          id: makeId('sched'),
          dueAt: Date.now(),
          kind: 'comment',
          payload: {
            parentPostId: commentPostId,
            npcId: replier.id,
            text: fallbackText,
            tags: payload.tags,
            aiEligible: true,
          },
        }
      }

      return { posts, postOrder: [commentPost.id, ...state.postOrder], profiles }
    })

    // Fired after the set() above completes — never nest a set() call
    // inside another set()'s updater.
    if (replyItem) processComments([replyItem])
    else {
      const chainItem = nextChainItem(payload, commentPostId)
      if (chainItem) processComments([chainItem])
    }
  }

  // In a thread the player replied into, an NPC's reply can pull one more
  // participant in — someone else in the thread answering the new comment,
  // or answering the player directly. Each hop is less likely than the last
  // and the chain stops at MAX_CHAIN_DEPTH, so it can never loop.
  const MAX_CHAIN_DEPTH = 2
  const MAX_THREAD_SIZE = 14
  function nextChainItem(payload: CommentPayload, commentPostId: string): ScheduledCommentItem | null {
    const depth = payload.chainDepth
    if (depth === undefined || depth >= MAX_CHAIN_DEPTH) return null
    const rng = mulberry32(hashStringToSeed(`${commentPostId}_chain`))
    if (rng() > (depth === 0 ? 0.55 : 0.25)) return null

    const st = get()
    const latest = st.posts[commentPostId]
    if (!latest) return null
    let root = latest
    while (root.parentId && st.posts[root.parentId]) root = st.posts[root.parentId]
    const childrenOf = new Map<string, string[]>()
    for (const p of Object.values(st.posts)) {
      if (!p.parentId) continue
      const list = childrenOf.get(p.parentId)
      if (list) list.push(p.id)
      else childrenOf.set(p.parentId, [p.id])
    }
    const authorIds = new Set<string>()
    const stack = [root.id]
    let size = 0
    while (stack.length > 0) {
      const id = stack.pop() as string
      const p = st.posts[id]
      if (!p) continue
      size++
      authorIds.add(p.authorId)
      stack.push(...(childrenOf.get(id) ?? []))
    }
    if (size > MAX_THREAD_SIZE) return null

    const candidates = [...authorIds]
      .filter((id) => id !== payload.npcId && id !== PLAYER_ID)
      .map((id) => st.profiles[id])
      .filter((n): n is NPC => !!n && isNPC(n))
    if (candidates.length === 0) return null
    const responder = pick(rng, candidates)

    // Answer the comment that just landed, or go straight at the player's own reply.
    let target = latest
    if (rng() < 0.5) {
      let cur = latest
      while (cur.parentId && st.posts[cur.parentId]) {
        cur = st.posts[cur.parentId]
        if (cur.authorId === PLAYER_ID) {
          target = cur
          break
        }
      }
    }
    if (target.authorId === responder.id) target = latest

    const pack = CAREER_PACKS[st.player.career]
    const playerProfile = st.profiles[PLAYER_ID] as Profile
    const linePool = responder.offTopic ? GENERIC_OFFTOPIC_REACTION_POOL : pack.reactionPool[responder.persona]
    const selection = selectLine(rng, linePool, [], responder.recentLineIds)
    const fallbackText = applyPersonalityVoice(
      fillTemplate(selection.line, { player: playerProfile.displayName, org: st.player.club || pack.worldName }),
      responder,
      rng,
    )
    set((s2) => ({
      profiles: {
        ...s2.profiles,
        [responder.id]: { ...responder, recentLineIds: pushRecentLine(responder.recentLineIds, selection.lineId) },
      },
    }))
    return {
      id: makeId('sched'),
      dueAt: Date.now(),
      kind: 'comment',
      payload: { parentPostId: target.id, npcId: responder.id, text: fallbackText, tags: [], aiEligible: true, chainDepth: depth + 1 },
    }
  }

  // Materializes every comment in the batch as fast as possible: instantly
  // for the deterministic path, or as soon as its AI network call resolves
  // for aiEligible ones (spec section 8, "gameplay never blocks on AI" —
  // any failure falls straight back to the already-computed template text).
  function processComments(items: readonly ScheduledCommentItem[]) {
    if (items.length === 0) return
    const config = aiConfigNow()
    const aiItems: ScheduledCommentItem[] = []

    for (const item of items) {
      const npc = get().profiles[item.payload.npcId]
      if (item.payload.aiEligible && config && npc && isNPC(npc)) aiItems.push(item)
      else materializeComment(item.payload, item.payload.text, item.dueAt, 'template')
    }
    if (aiItems.length === 0 || !config) return

    // One request for the whole batch — a post's entire comment section is a
    // single call, not one per commenter, so a key isn't drained.
    const snapshot = get()
    const playerProfile = snapshot.profiles[PLAYER_ID] as Profile
    const pack = CAREER_PACKS[snapshot.player.career]
    const batch: BatchCommentItem[] = aiItems.map((item) => {
      const target = snapshot.posts[item.payload.parentPostId]
      const targetAuthor = target ? snapshot.profiles[target.authorId] : undefined
      return {
        npc: snapshot.profiles[item.payload.npcId] as NPC,
        targetText: target?.text ?? '',
        targetAuthorName: targetAuthor?.displayName ?? 'someone',
        targetIsPlayer: target?.authorId === PLAYER_ID,
        targetIsReply: target?.kind === 'reply',
        newsFacts: item.payload.gossip,
      }
    })
    void generateAiCommentBatch({
      items: batch,
      playerDisplayName: playerProfile.displayName,
      orgName: snapshot.player.club || pack.worldName,
      recentActivity: snapshot.activityLog,
      config,
    }).then((texts) => {
      if (texts) recordSpend(config.id)
      aiItems.forEach((item, i) => {
        const aiText = texts?.get(i)
        if (aiText) materializeComment(item.payload, aiText, item.dueAt, 'ai')
        else materializeComment(item.payload, item.payload.text, item.dueAt, 'template')
      })
    })
  }

  // The existing fully-deterministic path: pick a line now, schedule it to
  // land a few seconds later with a typing indicator. Used whenever AI
  // isn't configured/enabled, or as the fallback when an AI call fails.
  function scheduleTemplateDmReply(npcId: string) {
    const state = get()
    const npc = state.profiles[npcId]
    if (!npc || !isNPC(npc)) return
    const pack = CAREER_PACKS[state.player.career]
    const playerProfile = state.profiles[PLAYER_ID] as Profile
    const rng = mulberry32(hashStringToSeed(`${npcId}_${Date.now()}_${state.scheduled.length}`))
    const reply = generateDmReply({
      npc,
      reactionPool: pack.reactionPool,
      playerDisplayName: playerProfile.displayName,
      orgName: state.player.club || pack.worldName,
      rng,
      now: Date.now(),
    })
    const scheduledItem: ScheduledItem = {
      id: makeId('sched'),
      dueAt: reply.dueAt,
      kind: 'dm',
      payload: { npcId, text: reply.text } satisfies DMSchedulePayload,
    }
    set((s) => ({
      profiles: { ...s.profiles, [npcId]: { ...npc, recentLineIds: reply.recentLineIds } },
      scheduled: [...s.scheduled, scheduledItem],
    }))
  }

  // Appends one narrator beat to an activity's transcript and sets the next
  // round of "what will you do" choices the player picks from (or ignores,
  // typing their own move instead).
  function appendActivityMessage(
    activityId: string,
    text: string,
    origin: ActivityMessage['origin'],
    choices: readonly string[],
  ) {
    set((state) => {
      const activity = state.activities[activityId]
      if (!activity) return state
      const msg: ActivityMessage = { id: makeId('msg'), from: 'narrator', text, at: Date.now(), origin }
      return {
        activities: {
          ...state.activities,
          [activityId]: { ...activity, messages: [...activity.messages, msg], pendingChoices: [...choices] },
        },
      }
    })
  }

  // Fires the next narrator beat for an activity — the AI path (narrated,
  // context-aware, plus the player's next choices) when available,
  // deterministic templates otherwise or on any failure. Same shape as the
  // DM/comment AI paths elsewhere in this file.
  function advanceActivity(activityId: string, isOpening: boolean, final = false) {
    const state = get()
    const activity = state.activities[activityId]
    if (!activity) return
    // Declined RSVPs (see startActivity) don't take part in the scene —
    // undefined (no rsvps computed, e.g. an activity from before this
    // feature existed) means "include them", same as always.
    const participants = activity.participantIds
      .filter((id) => activity.rsvps?.[id] !== 'declined')
      .map((id) => state.profiles[id])
      .filter((p): p is NPC => !!p && isNPC(p))
    const playerProfile = state.profiles[PLAYER_ID] as Profile
    const pack = CAREER_PACKS[state.player.career]
    const orgName = state.player.club || pack.worldName

    const config = state.settings.aiEnabled ? getProviderConfig(state.settings.activeProviderId) : undefined
    const aiEligible = !!config && canSpend(config.id, config.rpdBudget)

    const fallbackText = isOpening
      ? templatedActivityOpening(activity.description, participants)
      : final
        ? templatedActivityClosing(
            mulberry32(hashStringToSeed(`${activityId}_closing`)),
            activity.messages.at(-1)?.text ?? '',
            participants,
          )
        : templatedActivityBeat(
          mulberry32(hashStringToSeed(`${activityId}_${activity.messages.length}`)),
          activity.messages.at(-1)?.text ?? '',
          participants,
        )
    const fallbackChoices = final ? [] : ACTIVITY_CHOICES

    // The closing beat is shown first; only then does the activity end (and
    // its report card appear), so the player sees the result of their last
    // move instead of the scene just cutting off.
    const finish = () => {
      if (final) get().endActivity(activityId)
    }

    if (!aiEligible) {
      appendActivityMessage(activityId, fallbackText, 'template', fallbackChoices)
      finish()
      return
    }

    set((s) => ({ aiTyping: s.aiTyping.includes(activityId) ? s.aiTyping : [...s.aiTyping, activityId] }))

    void generateActivityTurn({
      description: activity.description,
      participants,
      playerDisplayName: playerProfile.displayName,
      orgName,
      recentMessages: activity.messages,
      config,
      final,
    }).then((turn) => {
      set((s) => ({ aiTyping: s.aiTyping.filter((id) => id !== activityId) }))
      if (turn) {
        recordSpend(config.id)
        appendActivityMessage(activityId, turn.beat, 'ai', final ? [] : turn.choices)
      } else {
        appendActivityMessage(activityId, fallbackText, 'template', fallbackChoices)
      }
      finish()
    })
  }

  // The gossip layer (see engine/gossip.ts): every player post, activity and
  // event gets a specific tabloid story, and people then comment about it —
  // under the tabloid's own post, under the other person's posts, under the
  // player's own posts, and now and then under an unrelated post — so the
  // world visibly reacts to what actually happened, with names and details.
  function runGossip(subject: GossipSubject) {
    const state = get()
    const npcs = Object.values(state.profiles).filter(isNPC)
    const outlet = pickMediaOutlet(npcs)
    if (!outlet) return
    const rng = mulberry32(hashStringToSeed(`${outlet.id}_${Date.now()}_gossip`))
    const facts = gossipFacts(subject)
    const fallbackText = applyPersonalityVoice(tabloidPostText(rng, subject), outlet, rng)

    function scheduleGossipComments(storyPostId: string) {
      const snapshot = get()
      const everyone = Object.values(snapshot.profiles).filter(isNPC)
      const subjectNpc = subject.subjectNpcId ? everyone.find((n) => n.id === subject.subjectNpcId) : undefined
      const participants = [...(subjectNpc ? [subjectNpc] : []), ...everyone.filter((n) => subject.others.includes(n.displayName))]
      const isParticipant = (id: string) => participants.some((p) => p.id === id)
      const isCommenter = (n: NPC) => tierForPersona(n.persona) === 'commenter' || n.persona === 'celebrity'
      let pool = everyone.filter((n) => isCommenter(n) && n.id !== outlet!.id && !isParticipant(n.id))
      if (pool.length === 0) pool = everyone.filter((n) => tierForPersona(n.persona) !== 'media' && !isParticipant(n.id))
      if (pool.length === 0) return

      const nowMs = Date.now()
      const items: ScheduledCommentItem[] = []
      const used = new Set<string>()
      const usedTexts = new Set<string>()
      const add = (parentPostId: string, target: CommentTarget, count: number, other?: string) => {
        for (let i = 0; i < count; i++) {
          const candidates = pool.filter((n) => !used.has(`${parentPostId}:${n.id}`))
          if (candidates.length === 0) break
          const npc = pick(rng, candidates)
          // Nobody repeats what someone already said under the same post.
          let text = ''
          for (let attempt = 0; attempt < 8 && (text === '' || usedTexts.has(`${parentPostId}:${text}`)); attempt++) {
            text = gossipCommentText(rng, subject, target, other)
          }
          if (usedTexts.has(`${parentPostId}:${text}`)) continue
          usedTexts.add(`${parentPostId}:${text}`)
          used.add(`${parentPostId}:${npc.id}`)
          items.push({
            id: makeId('sched'),
            dueAt: nowMs + randomInt(rng, 1_000, 25_000),
            kind: 'comment',
            payload: {
              parentPostId,
              npcId: npc.id,
              text: applyPersonalityVoice(text, npc, rng),
              tags: [...subject.tags],
              aiEligible: true,
              gossip: facts,
            },
          })
        }
      }
      const topLevel = (id: string) => snapshot.posts[id]
      const latestPostBy = (authorId: string) =>
        snapshot.postOrder.map(topLevel).find((p) => p && p.kind === 'post' && p.authorId === authorId)

      add(storyPostId, 'tabloid', randomInt(rng, 5, 8))
      for (const participant of participants.slice(0, 2)) {
        const theirPost = latestPostBy(participant.id)
        if (theirPost) add(theirPost.id, 'participant_post', randomInt(rng, 2, 3), participant.displayName)
      }
      if (subject.kind !== 'post' && !subject.world) {
        const playersPost = latestPostBy(PLAYER_ID)
        if (playersPost) add(playersPost.id, 'player_post', randomInt(rng, 2, 3), subject.others[0])
      }
      const unrelated = snapshot.postOrder
        .map(topLevel)
        .filter(
          (p): p is Post =>
            !!p &&
            p.kind === 'post' &&
            p.id !== storyPostId &&
            p.authorId !== PLAYER_ID &&
            p.authorId !== outlet!.id &&
            !isParticipant(p.authorId),
        )
        .slice(0, 25)
      const unrelatedCount = randomInt(rng, 1, 2)
      for (let i = 0; i < unrelatedCount && unrelated.length > 0; i++) {
        const [post] = unrelated.splice(Math.floor(rng() * unrelated.length), 1)
        add(post.id, 'unrelated', 1, subject.others[0])
      }
      processComments(items)
    }

    function materializeStory(text: string, origin: Post['origin']) {
      const engagement = estimateEngagement(rng, outlet!.followers, 45, subject.tags)
      const story: Post = {
        id: makeId('post'),
        authorId: outlet!.id,
        kind: 'post',
        text,
        tags: [...subject.tags],
        createdAt: Date.now(),
        gameDay: get().gameDay,
        likes: engagement.likes,
        reposts: engagement.reposts,
        replies: 0,
        origin,
      }
      // News breaks the day's stories first, so it goes at the bottom of
      // the current day's posts (with the oldest timestamp), leaving
      // everyone else above it to react.
      set((st) => {
        const today = st.postOrder.filter((id) => st.posts[id]?.kind === 'post' && st.posts[id]?.gameDay === story.gameDay)
        const oldest = today.reduce((min, id) => Math.min(min, st.posts[id].createdAt), story.createdAt)
        story.createdAt = oldest - 60_000
        const lastToday = today.at(-1)
        const at = lastToday ? st.postOrder.indexOf(lastToday) + 1 : 0
        const postOrder = [...st.postOrder.slice(0, at), story.id, ...st.postOrder.slice(at)]
        const involved = Object.values(st.profiles)
          .filter(isNPC)
          .filter((n) => subject.others.includes(n.displayName) || n.id === subject.subjectNpcId)
          .map((n) => n.id)
        const remembered: WorldStory = {
          id: makeId('news'),
          day: st.gameDay,
          text: story.text,
          people: subject.world ? involved : [PLAYER_ID, ...involved],
        }
        return {
          posts: { ...st.posts, [story.id]: story },
          postOrder,
          worldStories: [...st.worldStories, remembered].slice(-60),
        }
      })
      scheduleGossipComments(story.id)
    }

    const config = state.settings.aiEnabled ? getProviderConfig(state.settings.activeProviderId) : undefined
    if (!config || !canSpend(config.id, config.rpdBudget)) {
      materializeStory(fallbackText, 'template')
      return
    }

    void generateMediaCoverage({
      npc: outlet,
      description: facts,
      playerDisplayName: subject.playerName,
      config,
    }).then((aiText) => {
      if (aiText) {
        recordSpend(config.id)
        materializeStory(aiText, 'ai')
      } else {
        materializeStory(fallbackText, 'template')
      }
    })
  }

  // Resolves the player's Event choice (predetermined or freely typed).
  // Stat/follower effects are always deterministic and apply immediately;
  // only the outcome NARRATION tries AI first (grounded in the situation
  // and the tier already rolled), falling back to a canned line on any
  // failure — the activity log entry is written once the final text is
  // known, so it never disagrees with what was shown.
  function finishEncounter(choice: EncounterChoice) {
    const state = get()
    const encounter = state.activeEncounter
    if (!encounter) return
    const encounterId = encounter.id
    const encounterText = encounter.text
    const encounterCelebId = encounter.celebId

    const rng = mulberry32(hashStringToSeed(`${encounterId}_resolve_${choice.id}_${Date.now()}`))
    const tier = rollTier(rng, choice.risk)
    const playerProfile = state.profiles[PLAYER_ID] as Profile
    const rawOutcome = tierOutcome(tier, playerProfile.followers)
    // A private moment doesn't change your following or make the news.
    const eventPublicity = resolvePublicity(`${encounterText} ${choice.label}`, rawOutcome.tags, rng())
    const eventIsPublic = eventPublicity.isPublic
    const outcome = eventIsPublic
      ? rawOutcome
      : { ...rawOutcome, followerDelta: 0, statDeltas: rawOutcome.statDeltas.filter((e) => e.type !== 'followers') }
    const fallbackText = outcomeText(rng, tier)

    const nextPlayer = {
      ...applyPlayerEffects(state.player, outcome.statDeltas),
      ...lastStatChangesFromEffects(outcome.statDeltas, fallbackText, Date.now()),
    }
    const nextPlayerProfile: Profile = {
      ...playerProfile,
      followers: Math.max(0, playerProfile.followers + outcome.followerDelta),
      lastFollowerChange:
        outcome.followerDelta !== 0
          ? { delta: outcome.followerDelta, reason: fallbackText, at: Date.now() }
          : playerProfile.lastFollowerChange,
    }

    set((s) => ({
      player: nextPlayer,
      profiles: { ...s.profiles, [PLAYER_ID]: nextPlayerProfile },
      activeEncounter:
        s.activeEncounter && s.activeEncounter.id === encounterId
          ? { ...s.activeEncounter, loading: true, pendingChoiceLabel: choice.label }
          : s.activeEncounter,
    }))

    function finalize(resolutionText: string) {
      set((s) => {
        if (!s.activeEncounter || s.activeEncounter.id !== encounterId) return s
        return {
          activeEncounter: {
            ...s.activeEncounter,
            loading: false,
            resolution: { text: resolutionText, tier, statDeltas: outcome.statDeltas, followerDelta: outcome.followerDelta },
          },
        }
      })

      const logEntry: ActivityLogEntry = {
        id: makeId('log'),
        at: Date.now(),
        action: 'event',
        deltas: outcome.statDeltas,
        summary: `Event: ${encounterText} — chose "${choice.label}". ${resolutionText}`,
      }
      const report: OutcomeReport = {
        kind: 'event',
        xpGained: xpFromEffects(outcome.statDeltas),
        statDeltas: outcome.statDeltas,
        followerDelta: outcome.followerDelta,
        relationshipChanges: [],
        reason: resolutionText,
        details: {
          summary: `${encounterText} You chose: "${choice.label}". ${resolutionText}`,
          statReasons: explainStatDeltas(
            outcome.tags,
            outcome.statDeltas,
            'event',
            tier === 'good' ? 'The moment played well and won people over.' : tier === 'bad' ? 'It went badly and cost you some of your audience.' : 'Your audience shifted.',
            outcome.followerDelta,
            { tier },
          ),
          relationships: [],
          signals: outcome.tags,
          buzz: eventIsPublic
            ? `${eventPublicity.leaked ? 'Somehow the paparazzi found out. ' : ''}${pickMediaOutlet(Object.values(get().profiles).filter(isNPC))?.displayName ?? 'The tabloids'} ran a story about this — look for it in the feed and in the comments around it.`
            : 'This stayed private — nobody outside knows, so no followers and no headlines.',
        },
      }
      set((s) => ({ activityLog: [...s.activityLog, logEntry], lastOutcomeReport: report }))
      advanceDay()

      if (eventIsPublic && encounterCelebId) celebResponds({ kind: 'event', npcIds: [encounterCelebId], detail: encounterText, chance: 0.5 })

      // Only public moments make the news.
      if (eventIsPublic)
      runGossip({
        kind: 'event',
        playerName: playerProfile.displayName,
        detail: encounterText,
        tags: outcome.tags,
        others: [],
        eventTier: tier,
        eventMove: choice.label,
      })
    }

    const config = state.settings.aiEnabled ? getProviderConfig(state.settings.activeProviderId) : undefined
    const aiOk = !!config && canSpend(config.id, config.rpdBudget)
    if (!aiOk) {
      finalize(fallbackText)
      return
    }

    void generateAiEncounterOutcome({
      situationText: encounterText,
      choiceLabel: choice.label,
      tier,
      playerDisplayName: playerProfile.displayName,
      config,
    }).then((aiText) => {
      if (aiText) {
        recordSpend(config.id)
        finalize(aiText)
      } else {
        finalize(fallbackText)
      }
    })
  }

  return {
  ...buildInitialState(BOOTSTRAP_INPUT),
  clock: Date.now(),
  threads: {},
  aiTyping: [],
  scheduled: [],
  settings: defaultSettings(),
  activityLog: [],
  undoStack: [],
  worldSettings: defaultWorldSettings(),
  achievements: [],
  mutedAccounts: [],
  worldStories: [],
  activities: {},
  activeEncounter: null,
  onboarded: false,
  lastOutcomeReport: null,

  completeOnboarding: async (input) => {
    const pack = CAREER_PACKS[input.career]
    // Provider keys persist independently of the per-game `settings` state
    // (which is about to get reset below anyway) — the onboarding "connect
    // AI" step (Onboarding.tsx) writes here directly via upsertProviderConfig,
    // and a returning player who configured AI in a previous playthrough
    // shouldn't lose it just because they're starting a new one.
    const configs = loadProviderConfigs()
    const config = configs[0]
    const aiEligible = !!config && canSpend(config.id, config.rpdBudget)

    // Every universe: the fixed news/tabloid outlets (CNN, Sky Sports, TMZ),
    // the celebrities the player added at onboarding (no predetermined
    // teammate/coach/etc roles), and the everyday public (fans/haters/memes)
    // from AI or the deterministic fallback.
    const rng = mulberry32(hashStringToSeed(`${input.username}_roster`))
    const usedUsernames = new Set<string>()
    const mediaSeeds = buildFixedMediaSeeds(rng)
    for (const m of mediaSeeds) usedUsernames.add(m.username)
    const celebSeeds = await buildCelebSeeds(padCelebs(input.celebs ?? [], rng), aiEligible ? config : undefined, rng, usedUsernames)
    const celebAvatarPool = celebSeeds.flatMap((c) => (c.avatar?.kind === 'webp' ? [c.avatar.value] : []))

    let commenterSeeds: NPCSeed[] | undefined
    if (aiEligible && canSpend(config.id, config.rpdBudget)) {
      const generated = await generateRoster({ input, pack, config, celebAvatarPool, usedUsernames })
      if (generated) {
        recordSpend(config.id)
        commenterSeeds = generated
      }
    }
    if (!commenterSeeds) commenterSeeds = buildFallbackRoster(pack, input, rng, usedUsernames, celebAvatarPool)
    const npcSeeds: NPCSeed[] = [...mediaSeeds, ...celebSeeds, ...commenterSeeds]

    const world = buildInitialState(input, npcSeeds)

    // Personalizes a handful of the celeb tier's very first posts (still
    // just template text at this point — createSeededWorld never calls AI)
    // so a celeb's opening post sounds like them, not a generic per-persona
    // line. Never blocks the game on this: any failure just leaves the
    // template line in place. See ai/seedContentService.ts.
    if (aiEligible && config) {
      const orgName = input.org || pack.worldName
      const npcList = Object.values(world.profiles).filter(isNPC)
      const celebTargets = npcList.filter((n) => tierForPersona(n.persona) === 'celeb').slice(0, MAX_AI_SEED_POSTS)
      const firstPostIdByAuthor = new Map<string, string>()
      for (const postId of world.postOrder) {
        const post = world.posts[postId]
        if (post?.kind === 'post' && !firstPostIdByAuthor.has(post.authorId)) firstPostIdByAuthor.set(post.authorId, postId)
      }
      const results = await Promise.all(
        celebTargets.map(async (npc) => {
          const postId = firstPostIdByAuthor.get(npc.id)
          if (!postId || !canSpend(config.id, config.rpdBudget)) return null
          const text = await generateAiSeedPost(npc, orgName, config)
          if (!text) return null
          recordSpend(config.id)
          return { postId, text }
        }),
      )
      for (const result of results) {
        if (result) world.posts[result.postId] = { ...world.posts[result.postId], text: result.text, origin: 'ai' }
      }
    }

    // AI mode: no canned comments in the opening feed either — strip them and
    // let the AI write the visible ones (falls back to the canned ones on failure).
    const strippedCounts: Record<string, number> = {}
    if (aiEligible && config) {
      for (const [id, p] of Object.entries(world.posts)) {
        if (p.kind === 'reply') {
          delete world.posts[id]
        } else if (p.replies > 0) {
          strippedCounts[id] = p.replies
          world.posts[id] = { ...p, replies: 0 }
        }
      }
      world.postOrder = world.postOrder.filter((id) => world.posts[id])
    }

    set({
      ...world,
      clock: Date.now(),
      threads: {},
      aiTyping: [],
      scheduled: [],
      // Carries a configured provider into the new game so AI-powered DMs
      // and comments keep working after onboarding, not just the roster —
      // the player just opted into AI, defaultSettings() alone would silently
      // leave it off.
      settings: config ? { ...defaultSettings(), aiEnabled: true, activeProviderId: config.id } : defaultSettings(),
      activityLog: [],
      undoStack: [],
      worldSettings: defaultWorldSettings(),
      achievements: [],
      mutedAccounts: [],
      worldStories: [],
      activities: {},
      activeEncounter: null,
      onboarded: true,
      lastOutcomeReport: null,
    })

    void hydrateKnowledge()

    if (aiEligible && config) {
      const all = Object.values(get().posts)
      const topLevel = all.filter((p) => p.kind !== 'reply')
      const feed = get().postOrder.map((id) => get().posts[id]).filter((p) => p?.kind === 'post').slice(0, 8)
      const stories = all.filter((p) => p.kind === 'story' && p.authorId !== PLAYER_ID).slice(0, 5)
      void aiPopulateComments([...feed, ...stories], (p) => Math.min(p.kind === 'story' ? 5 : 10, strippedCounts[p.id] ?? 6)).then((ok) => {
        if (!ok) addTemplateReplies(topLevel, strippedCounts)
        // everything the AI didn't cover (older posts, other stories) still gets a real section
        else fillThinThreads(topLevel, 4, (p) => strippedCounts[p.id] ?? 5)
      })
    }
  },

  followNpc: (npcId) => {
    set((state) => {
      const npc = state.profiles[npcId]
      if (!npc || !isNPC(npc) || npc.followedByPlayer || !isFollowable(npc)) return state
      const player = state.profiles[PLAYER_ID]
      return {
        profiles: {
          ...state.profiles,
          [npcId]: { ...npc, followedByPlayer: true, followers: npc.followers + 1 },
          [PLAYER_ID]: { ...player, following: player.following + 1 },
        },
      }
    })
  },

  unfollowNpc: (npcId) => {
    set((state) => {
      const npc = state.profiles[npcId]
      if (!npc || !isNPC(npc) || !npc.followedByPlayer) return state
      const player = state.profiles[PLAYER_ID]
      return {
        profiles: {
          ...state.profiles,
          [npcId]: { ...npc, followedByPlayer: false, followers: Math.max(0, npc.followers - 1) },
          [PLAYER_ID]: { ...player, following: Math.max(0, player.following - 1) },
        },
      }
    })
  },

  updatePlayerProfile: (patch) => {
    set((state) => {
      const player = state.profiles[PLAYER_ID]
      if (!player) return state
      return { profiles: { ...state.profiles, [PLAYER_ID]: { ...player, ...patch } } }
    })
  },

  muteAccount: (profileId) => {
    set((state) =>
      state.mutedAccounts.includes(profileId)
        ? state
        : { mutedAccounts: [...state.mutedAccounts, profileId] },
    )
  },

  unmuteAccount: (profileId) => {
    set((state) => ({ mutedAccounts: state.mutedAccounts.filter((id) => id !== profileId) }))
  },

  addCustomPerson: (input) => {
    const id = makeId('npc')
    const now = Date.now()
    const rng = mulberry32(hashStringToSeed(id))

    // No "public role"/"relationship" pickers — a custom person only gives a
    // name, handle, bio, followers and an optional picture. Which content
    // pool they post/react from, and their default relationship vibe, are
    // inferred from that text (see personaInference.ts).
    const persona = inferPersonaFromBio(input.displayName, input.bio)
    const vibe = defaultVibeForPersona(persona)

    const npc: NPC = {
      id,
      username: input.username.replace(/^@/, '').trim() || id,
      displayName: input.displayName.trim() || 'New Person',
      bio: input.bio.trim(),
      avatar: input.avatar ?? { kind: 'initials', value: initialsFor(input.displayName || 'NP') },
      verified: input.verified ?? false,
      followers: input.followers && input.followers > 0 ? Math.round(input.followers) : randomInt(rng, 500, 50_000),
      following: randomInt(rng, 50, 500),
      joinedAt: now,
      isPlayer: false,
      persona,
      personality: input.personality ?? [],
      // Every relationship starts neutral — see content/seed.ts startingRelationship.
      relationship: 0,
      vibe,
      mood: 0,
      postingStyle: { emoji: 0.4, caps: 0.1, hashtags: 0.1 },
      recentLineIds: [],
      // Only celebs are followable at all (see engine/npcTier.ts) — a
      // commenter- or media-tier custom person is added to the roster but
      // never auto-followed, since the player couldn't follow them via the
      // UI either.
      followedByPlayer: tierForPersona(persona) === 'celeb',
      custom: true,
      // A roleless celebrity is just themselves — never the career pack's
      // sport/industry lines.
      offTopic: persona === 'celebrity' ? true : undefined,
    }

    set((state) => {
      const profiles = { ...state.profiles, [id]: npc }
      const playerProfile = state.profiles[PLAYER_ID] as Profile
      const followingCount = Object.values(profiles).filter((p) => isNPC(p) && p.followedByPlayer).length

      // Give them one live story right away, in the same voice/content pool
      // as the rest of the roster — reuses seedPostPool, no new content
      // needed. Commenter-tier people never author their own posts/stories.
      const pack = CAREER_PACKS[state.player.career]
      const lines =
        isViewableProfile(npc) && persona !== 'tabloid' && persona !== 'insider' ? pack.seedPostPool[persona] : undefined
      let posts = state.posts
      let postOrder = state.postOrder
      const celebNames: Record<string, string> = {}
      for (const p of Object.values(profiles)) celebNames[p.id] = p.displayName
      const storyText =
        tierForPersona(persona) === 'celeb'
          ? specificCelebPost(rng, npc, state.worldStories, celebNames)
          : lines && lines.length > 0
            ? fillTemplate(pick(rng, lines), { org: state.player.club || pack.worldName, org_upper: (state.player.club || pack.worldName).toUpperCase() })
            : null
      if (storyText) {
        const text = storyText
        const story: Post = {
          id: makeId('post'),
          authorId: id,
          kind: 'story',
          text,
          tags: [],
          createdAt: now,
          gameDay: state.gameDay,
          expiresAt: now + STORY_TTL_MS,
          likes: 0,
          reposts: 0,
          replies: storyCommentCount(rng, npc.followers),
          origin: 'template',
        }
        const npcRecord: Record<string, NPC> = {}
        for (const p of Object.values(profiles)) if (isNPC(p)) npcRecord[p.id] = p
        const storyComments = aiConfigNow()
          ? []
          : seedReplies(pack, rng, npcRecord, [story], state.player.club || pack.worldName, existingStoryCommentTexts(state.posts))
        posts = { ...posts, [story.id]: story }
        for (const c of storyComments) posts[c.id] = c
        postOrder = [...storyComments.map((c) => c.id), story.id, ...postOrder]
      }

      return {
        profiles: { ...profiles, [PLAYER_ID]: { ...playerProfile, following: followingCount } },
        posts,
        postOrder,
      }
    })

    void hydrateKnowledge()

    // AI mode: the new person's story gets AI comments instead of canned ones.
    const newStory = Object.values(get().posts).find((p) => p.kind === 'story' && p.authorId === id)
    if (newStory && newStory.replies > 0 && !Object.values(get().posts).some((p) => p.parentId === newStory.id)) {
      const counts = { [newStory.id]: newStory.replies }
      void aiPopulateComments([newStory], (p) => Math.min(8, p.replies)).then((ok) => {
        if (!ok) addTemplateReplies([newStory], counts)
      })
    }

    return id
  },

  removeCustomPerson: (npcId) => {
    set((state) => {
      const npc = state.profiles[npcId]
      if (!npc || !isNPC(npc) || !npc.custom) return state

      const profiles = { ...state.profiles }
      delete profiles[npcId]
      const playerProfile = state.profiles[PLAYER_ID] as Profile
      const followingCount = Object.values(profiles).filter((p) => isNPC(p) && p.followedByPlayer).length
      profiles[PLAYER_ID] = { ...playerProfile, following: followingCount }

      const posts = { ...state.posts }
      const postOrder = state.postOrder.filter((id) => {
        if (posts[id]?.authorId !== npcId) return true
        delete posts[id]
        return false
      })

      const threads = { ...state.threads }
      delete threads[npcId]

      return { profiles, posts, postOrder, threads }
    })
  },

  toggleLike: (postId) => {
    set((state) => {
      const post = state.posts[postId]
      if (!post) return state
      const likedByPlayer = !post.likedByPlayer
      return {
        posts: {
          ...state.posts,
          [postId]: {
            ...post,
            likedByPlayer,
            likes: post.likes + (likedByPlayer ? 1 : -1),
          },
        },
      }
    })
  },

  dismissOutcomeReport: () => set({ lastOutcomeReport: null }),

  addPlayerReply: (parentId, text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const replyId = makeId('post')
    set((state) => {
      const parent = state.posts[parentId]
      if (!parent) return state
      const playerReplyEngagement = estimateReplyEngagement(
        mulberry32(hashStringToSeed(`${replyId}_engagement`)),
        state.profiles[PLAYER_ID]?.followers ?? 0,
        (state.player.humor + state.player.aura) / 2,
      )
      const reply: Post = {
        id: replyId,
        authorId: PLAYER_ID,
        kind: 'reply',
        parentId,
        text: trimmed,
        tags: [],
        createdAt: Date.now(),
        gameDay: state.gameDay,
        likes: playerReplyEngagement.likes,
        reposts: playerReplyEngagement.reposts,
        replies: 0,
        origin: 'player',
      }
      return {
        posts: {
          ...state.posts,
          [reply.id]: reply,
          [parentId]: { ...parent, replies: parent.replies + 1 },
        },
        postOrder: [reply.id, ...state.postOrder],
      }
    })

    // People reply when replied to — whoever's post this is gets a
    // guaranteed comment back, reacting to what the player just said (AI
    // path), or a personality-flavored template line otherwise. Never the
    // player replying to themselves. Nests as a child of the player's own
    // new reply (continuing the thread downward), not a sibling of it.
    const state = get()
    const parent = state.posts[parentId]
    const parentAuthor = parent ? state.profiles[parent.authorId] : undefined
    if (parent && parentAuthor && isNPC(parentAuthor)) {
      const pack = CAREER_PACKS[state.player.career]
      const rng = mulberry32(hashStringToSeed(`${parentId}_replyback_${Date.now()}`))
      const linePool = parentAuthor.offTopic ? GENERIC_OFFTOPIC_REACTION_POOL : pack.reactionPool[parentAuthor.persona]
      const selection = selectLine(rng, linePool, [], parentAuthor.recentLineIds)
      const playerProfile = state.profiles[PLAYER_ID] as Profile
      const filled = fillTemplate(selection.line, {
        player: playerProfile.displayName,
        org: state.player.club || pack.worldName,
      })
      const fallbackText = applyPersonalityVoice(filled, parentAuthor, rng)

      set((s) => ({
        profiles: {
          ...s.profiles,
          [parentAuthor.id]: { ...parentAuthor, recentLineIds: pushRecentLine(parentAuthor.recentLineIds, selection.lineId) },
        },
      }))

      processComments([
        {
          id: makeId('sched'),
          dueAt: Date.now(),
          kind: 'comment',
          // parentPostId points at the player's own new reply (replyId), not
          // the original parent — nests the NPC's response as a child of
          // what the player just said, and (via processComments' AI
          // grounding, which reads this same field's post text) means the
          // AI reacts to the player's actual words instead of the original
          // post/comment.
          payload: { parentPostId: replyId, npcId: parentAuthor.id, text: fallbackText, tags: [], aiEligible: true, chainDepth: 0 },
        },
      ])
    }

    const target = parent ? get().profiles[parent.authorId] : undefined
    const targetName = target?.displayName ?? 'someone'
    lightActionReport({
      kind: 'comment',
      subject: 'reply',
      text: trimmed,
      summary: `You ${parent?.kind === 'reply' ? 'replied to' : 'commented on'} ${targetName}: "${trimmed.length > 90 ? `${trimmed.slice(0, 90)}…` : trimmed}"${parentAuthor && isNPC(parentAuthor) ? ` ${targetName} and others in the thread may answer.` : ''}`,
      caption: `From your ${parent?.kind === 'reply' ? 'reply' : 'comment'} to ${targetName}`,
      npcIds: target && isNPC(target) ? [target.id] : [],
      npcDelta: 1,
      scale: 0.5,
    })

    // Sticking up for someone in public is the kind of thing they answer in a post of their own.
    if (target && isNPC(target)) {
      const defending = /defend|support|proud|leave (him|her|them)|got your back|standing with|love you|deserve|hate on/i.test(trimmed)
      celebResponds({ kind: 'reply', npcIds: [target.id], detail: trimmed, chance: defending ? 0.7 : 0.15 })
    }
  },

  submitPlayerStory: (caption) => {
    const trimmed = caption.trim()
    if (!trimmed) return
    const now = Date.now()
    set((state) => {
      const story: Post = {
        id: makeId('post'),
        authorId: PLAYER_ID,
        kind: 'story',
        text: trimmed,
        tags: [],
        createdAt: now,
        gameDay: state.gameDay,
        expiresAt: now + STORY_TTL_MS,
        likes: 0,
        reposts: 0,
        replies: 0,
        origin: 'player',
      }
      return {
        posts: { ...state.posts, [story.id]: story },
        postOrder: [story.id, ...state.postOrder],
      }
    })
    lightActionReport({
      kind: 'story',
      subject: 'story',
      text: trimmed,
      summary: `You shared a story: "${trimmed.length > 90 ? `${trimmed.slice(0, 90)}…` : trimmed}". It's up for the next 24 hours for your followers to see.`,
      caption: 'From your story',
      npcIds: [],
      npcDelta: 0,
      scale: 0.7,
      followerBonus: true,
    })

    // People react to your story too — sized by how big you are.
    const posted = Object.values(get().posts).find((p) => p.kind === 'story' && p.authorId === PLAYER_ID && p.createdAt === now)
    if (posted) {
      const count = storyCommentCount(mulberry32(hashStringToSeed(`${posted.id}_crowd`)), (get().profiles[PLAYER_ID] as Profile).followers)
      if (aiConfigNow()) {
        void aiPopulateComments([posted], () => count).then((ok) => {
          if (!ok) addTemplateReplies([posted], { [posted.id]: count })
        })
      } else {
        addTemplateReplies([posted], { [posted.id]: count })
      }
    }
  },

  submitPlayerPost: ({ caption }) => {
    const text = caption.trim()
    const now = Date.now()
    const state = get()
    const pack = CAREER_PACKS[state.player.career]
    // Humor/aura are detected generically, independent of the active
    // career's keyword rules — see engine/funMarkers.ts.
    const tags = [...scanKeywordTags(text, pack.keywordRules), ...funMarkerTags(text)]

    const post: Post = {
      id: makeId('post'),
      authorId: PLAYER_ID,
      kind: 'post',
      text,
      tags,
      createdAt: now,
      gameDay: state.gameDay,
      likes: 0,
      reposts: 0,
      replies: 0,
      origin: 'player',
    }

    const event = createGameEvent({
      type: 'player_post',
      tags,
      sourceId: post.id,
      timestamp: now,
    })

    const playerProfile = state.profiles[PLAYER_ID] as Profile
    const npcs = Object.values(state.profiles).filter(isNPC)
    const rng = mulberry32(hashStringToSeed(post.id))

    const result = runReactionEngine({
      event,
      postId: post.id,
      npcs,
      reactionPool: pack.reactionPool,
      // NPC-authored reactions need some org name to read naturally even if
      // the player never named one — that fallback stays out of player.club.
      orgName: state.player.club || pack.worldName,
      playerDisplayName: playerProfile.displayName,
      playerUsername: playerProfile.username,
      postText: text,
      playerFollowers: playerProfile.followers,
      playerSocialScore: (state.player.humor + state.player.aura) / 2,
      rng,
      now,
    })

    post.likes = result.engagement.likes
    post.reposts = result.engagement.reposts

    const postReason = `From your post: "${text.length > 60 ? `${text.slice(0, 60)}…` : text}"`
    const nextPlayer = {
      ...applyPlayerEffects(state.player, result.statDeltas),
      ...lastStatChangesFromEffects(result.statDeltas, postReason, now),
    }
    const nextPlayerProfile: Profile = {
      ...playerProfile,
      followers: playerProfile.followers + result.followerDelta,
      lastFollowerChange:
        result.followerDelta !== 0
          ? { delta: result.followerDelta, reason: postReason, at: now }
          : playerProfile.lastFollowerChange,
    }

    const updatedProfiles: Record<string, Profile | NPC> = {
      ...state.profiles,
      [PLAYER_ID]: nextPlayerProfile,
    }
    for (const [npcId, recentLineIds] of Object.entries(result.npcLineUpdates)) {
      const npc = updatedProfiles[npcId]
      if (npc && isNPC(npc)) updatedProfiles[npcId] = { ...npc, recentLineIds }
    }

    // The player's social circle — who they follow — gets a guaranteed
    // comment on every post (on top of the random crowd above), each
    // eligible for a live AI reply that can reference recent activity, plus
    // maybe one surprise non-follower and a little cross-talk between
    // circle members. See runSocialCircleEngine for the cost reasoning.
    const circleNpcs = npcs.filter((n) => n.followedByPlayer).slice(0, SOCIAL_CIRCLE_MAX)
    const nonCircle = npcs.filter((n) => !n.followedByPlayer)
    const oddCelebrity =
      nonCircle.length > 0 && rng() < ODD_CELEBRITY_CHANCE ? pick(rng, nonCircle) : null
    const circleResult = runSocialCircleEngine({
      event,
      postId: post.id,
      circleNpcs,
      oddCelebrity,
      reactionPool: pack.reactionPool,
      orgName: state.player.club || pack.worldName,
      playerDisplayName: playerProfile.displayName,
      rng,
      now,
    })
    for (const [npcId, recentLineIds] of Object.entries(circleResult.npcLineUpdates)) {
      const npc = updatedProfiles[npcId]
      if (npc && isNPC(npc)) updatedProfiles[npcId] = { ...npc, recentLineIds }
    }
    const commentItems = [...result.scheduledItems, ...circleResult.scheduledItems]

    // @mentioning someone actually does something — a small relationship
    // bump, so tagging people isn't purely cosmetic.
    const mentionedIds = extractMentionedIds(text, buildUsernameIndex(state.profiles))
    const relationshipChanges: RelationshipChangeSummary[] = []
    const relationshipDetails: OutcomeDetails['relationships'] = []
    for (const npcId of mentionedIds) {
      const npc = updatedProfiles[npcId]
      if (npc && isNPC(npc)) {
        const after = Math.min(100, npc.relationship + 2)
        updatedProfiles[npcId] = {
          ...npc,
          relationship: after,
          lastRelationshipChange: { delta: 2, reason: 'You tagged them in a post.', at: now },
        }
        relationshipChanges.push({ npcId, delta: 2 })
        relationshipDetails.push({
          npcId,
          delta: 2,
          before: npc.relationship,
          after,
          reason: 'You tagged them in a post, which shows you were thinking of them.',
        })
      }
    }

    // Decided up front so the report card can say whether the tabloids ran it.
    const tabloidRunsIt = tags.length > 0 || rng() < 0.25
    const tabloidName = pickMediaOutlet(npcs)?.displayName

    const logEntry: ActivityLogEntry = {
      id: makeId('log'),
      at: now,
      action: 'post',
      eventId: event.id,
      deltas: result.statDeltas,
      summary: `Posted: "${text.length > 60 ? `${text.slice(0, 60)}…` : text}"`,
    }

    const report: OutcomeReport = {
      kind: 'post',
      xpGained: xpFromEffects(result.statDeltas),
      statDeltas: result.statDeltas,
      followerDelta: result.followerDelta,
      relationshipChanges,
      reason: postReason,
      commentCount: commentItems.length,
      details: {
        summary: `You posted "${text.length > 90 ? `${text.slice(0, 90)}…` : text}". It pulled about ${result.engagement.likes.toLocaleString()} likes and ${result.engagement.reposts.toLocaleString()} reposts, and ${commentItems.length} ${commentItems.length === 1 ? 'person is' : 'people are'} replying.`,
        statReasons: explainStatDeltas(
          tags,
          result.statDeltas,
          'post',
          `About ${result.engagement.likes.toLocaleString()} likes and ${result.engagement.reposts.toLocaleString()} reposts pulled in new followers${tags.some((t) => ['controversial', 'criticism', 'setback'].includes(t)) ? ', partly offset by the backlash' : ''}.`,
          result.followerDelta,
        ),
        relationships: relationshipDetails,
        signals: tags,
        buzz: tabloidName
          ? tabloidRunsIt
            ? `${tabloidName} is running a story about this post — look for it in the feed and the comments on it.`
            : `${tabloidName} didn't pick this one up.`
          : undefined,
      },
    }

    set({
      posts: { ...state.posts, [post.id]: post },
      postOrder: [post.id, ...state.postOrder],
      profiles: updatedProfiles,
      player: nextPlayer,
      activityLog: [...state.activityLog, logEntry],
      lastOutcomeReport: report,
    })

    // Comments materialize as fast as possible — instantly for the
    // deterministic path, or as soon as each AI call resolves — rather than
    // trickling in through the scheduled-item/tick mechanism (which is
    // still used for DMs' deliberate typing delay).
    processComments(commentItems)
    advanceDay()

    celebResponds({ kind: 'post', npcIds: [...mentionedIds], detail: text, chance: 0.5 })

    // The tabloids pick up on most posts — always the newsworthy ones (a
    // detected tag), and more often than not the rest.
    if (tabloidRunsIt) {
      runGossip({
        kind: 'post',
        playerName: playerProfile.displayName,
        detail: text,
        tags,
        others: [...mentionedIds].flatMap((id) => {
          const npc = updatedProfiles[id]
          return npc && isNPC(npc) ? [npc.displayName] : []
        }),
      })
    }
  },

  beginDmSession: (npcId) => {
    dmSessionStart.set(npcId, get().threads[npcId]?.messages.length ?? 0)
  },

  // Leaving a chat is what earns the report card — not each text sent. Covers
  // only what you sent since you opened it (or since `sinceIndex`).
  finishDmSession: (npcId, sinceIndex) => {
    const thread = get().threads[npcId]
    const from = sinceIndex ?? dmSessionStart.get(npcId) ?? thread?.messages.length ?? 0
    dmSessionStart.delete(npcId)
    if (!thread) return
    const sent = thread.messages.slice(from).filter((m) => m.from === 'player')
    if (sent.length === 0) return
    const npc = get().profiles[npcId]
    if (!npc || !isNPC(npc)) return
    const all = sent.map((m) => m.text).join(' ')
    lightActionReport({
      kind: 'dm',
      subject: 'chat',
      text: all,
      summary: `You chatted with ${npc.displayName} — ${sent.length} ${sent.length === 1 ? 'message' : 'messages'} from you. Time spent in someone's DMs builds the relationship.`,
      caption: `From your chat with ${npc.displayName}`,
      npcIds: [npcId],
      npcDelta: sent.length >= 4 ? 2 : 1,
      scale: 0.5,
    })
  },

  sendPlayerMessage: (npcId, text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const now = Date.now()

    set((state) => {
      const npc = state.profiles[npcId]
      if (!npc || !isNPC(npc) || !isDmAvailable(npc)) return state
      const playerMsg: DMMessage = { id: makeId('msg'), from: 'player', text: trimmed, at: now, origin: 'player' }
      const existing = state.threads[npcId]
      const thread: DMThread = existing
        ? { ...existing, messages: [...existing.messages, playerMsg] }
        : { id: npcId, npcId, messages: [playerMsg], unread: 0 }
      return { threads: { ...state.threads, [npcId]: thread } }
    })

    const state = get()
    const npc = state.profiles[npcId]
    if (!npc || !isNPC(npc) || !isDmAvailable(npc)) return

    // AI is only ever used when explicitly enabled, a provider is
    // configured (key lives in localStorage — never in this state), and
    // today's free-tier budget hasn't been spent. Any gap here just falls
    // through to the deterministic template path — gameplay never blocks
    // on AI (PROJECT_SPEC.md section 8, robustness rule 1).
    const config = state.settings.aiEnabled ? getProviderConfig(state.settings.activeProviderId) : undefined
    const aiEligible = !!config && canSpend(config.id, config.rpdBudget)

    if (!aiEligible) {
      scheduleTemplateDmReply(npcId)
      return
    }

    set((s) => ({ aiTyping: s.aiTyping.includes(npcId) ? s.aiTyping : [...s.aiTyping, npcId] }))

    const playerProfile = state.profiles[PLAYER_ID] as Profile
    const pack = CAREER_PACKS[state.player.career]
    const recentMessages = get().threads[npcId]?.messages ?? []

    void generateAiDmReply({
      npc,
      playerDisplayName: playerProfile.displayName,
      orgName: state.player.club || pack.worldName,
      recentMessages,
      config,
    }).then((aiText) => {
      set((s) => ({ aiTyping: s.aiTyping.filter((id) => id !== npcId) }))
      if (aiText) {
        recordSpend(config.id)
        appendNpcDmMessage(npcId, aiText, 'ai')
      } else {
        scheduleTemplateDmReply(npcId)
      }
    })
  },

  markThreadRead: (npcId) => {
    set((state) => {
      const thread = state.threads[npcId]
      if (!thread || thread.unread === 0) return state
      return { threads: { ...state.threads, [npcId]: { ...thread, unread: 0 } } }
    })
  },

  // Always creates in 'scheduled' status — activities never auto-start.
  // The player explicitly taps Start (startActivity) whenever they want to
  // actually begin the scene, which is when the opening beat is generated.
  createActivity: (input) => {
    const state = get()
    const pack = CAREER_PACKS[state.player.career]
    const tags = scanKeywordTags(input.description, pack.keywordRules)
    const now = Date.now()
    const id = makeId('activity')

    const activity: Activity = {
      id,
      description: input.description.trim(),
      participantIds: input.participantIds,
      status: 'scheduled',
      startAt: now,
      plannedLabel: input.plannedLabel,
      createdAt: now,
      messages: [],
      turnCount: 0,
      tags,
      pendingChoices: [],
    }

    set((s) => ({ activities: { ...s.activities, [id]: activity } }))
    return id
  },

  startActivity: (activityId) => {
    const activity = get().activities[activityId]
    if (!activity || activity.status !== 'scheduled') return
    const state = get()
    const rng = mulberry32(hashStringToSeed(`${activityId}_rsvp`))
    const rsvps: Record<string, RsvpDecision> = {}
    for (const npcId of activity.participantIds) {
      const npc = state.profiles[npcId]
      if (npc && isNPC(npc)) rsvps[npcId] = computeRsvp(npc, rng)
    }
    // A solo-invite activity ("go on a date with X") where the one person
    // invited declines never actually happened — cancel it outright rather
    // than running a scene with nobody there, and never touch advanceDay
    // (see endActivity/submitPlayerPost/finishEncounter — only those charge
    // a day) so the player can freely start a different activity right away.
    const soloDeclined = activity.participantIds.length === 1 && rsvps[activity.participantIds[0]] === 'declined'
    if (soloDeclined) {
      set((s) => ({
        activities: { ...s.activities, [activityId]: { ...activity, status: 'cancelled', rsvps } },
      }))
      return
    }
    set((s) => ({
      activities: { ...s.activities, [activityId]: { ...activity, status: 'active', rsvps } },
    }))
    advanceActivity(activityId, true)
  },

  deleteActivity: (activityId) => {
    set((s) => {
      if (!s.activities[activityId]) return s
      const activities = { ...s.activities }
      delete activities[activityId]
      return { activities }
    })
  },

  sendActivityChoice: (activityId, text) => {
    const trimmed = text.trim()
    if (!trimmed) return

    set((state) => {
      const activity = state.activities[activityId]
      // Already on the closing beat — nothing more to play.
      if (!activity || activity.status !== 'active' || activity.turnCount >= ACTIVITY_TURN_CAP) return state
      const msg: ActivityMessage = { id: makeId('msg'), from: 'player', text: trimmed, at: Date.now(), origin: 'player' }
      return {
        activities: {
          ...state.activities,
          [activityId]: {
            ...activity,
            messages: [...activity.messages, msg],
            turnCount: activity.turnCount + 1,
            pendingChoices: [],
          },
        },
      }
    })

    const activity = get().activities[activityId]
    if (!activity || activity.messages.at(-1)?.text !== trimmed) return
    // The last allowed turn still gets its narrator reaction — a closing
    // beat that wraps the scene up — and the activity ends right after it.
    advanceActivity(activityId, false, activity.turnCount >= ACTIVITY_TURN_CAP)
  },

  endActivity: (activityId) => {
    const state = get()
    const activity = state.activities[activityId]
    if (!activity || activity.status === 'ended') return

    // Only the people who actually showed up (see startActivity's RSVPs) take
    // part in the result — a declined invite gains nothing and isn't in the
    // tabloid story.
    const participants = activity.participantIds
      .filter((id) => activity.rsvps?.[id] !== 'declined')
      .map((id) => state.profiles[id])
      .filter((p): p is NPC => !!p && isNPC(p))
    // Spending time together is inherently relationship-positive here —
    // longer scenes (more turns) matter more, capped so one activity can't
    // max out a relationship on its own.
    const relationshipDelta = Math.min(15, 5 + activity.turnCount * 2)

    const updatedProfiles = { ...state.profiles }
    const activityRelationships: OutcomeDetails['relationships'] = []
    for (const npc of participants) {
      const after = Math.max(-100, Math.min(100, npc.relationship + relationshipDelta))
      updatedProfiles[npc.id] = {
        ...npc,
        relationship: after,
        lastRelationshipChange: { delta: relationshipDelta, reason: activity.description, at: Date.now() },
      }
      activityRelationships.push({
        npcId: npc.id,
        delta: relationshipDelta,
        before: npc.relationship,
        after,
        reason: `Spending ${activity.turnCount} ${activity.turnCount === 1 ? 'turn' : 'turns'} together on "${activity.description}" brings people closer (more turns, more effect — capped per activity).`,
      })
    }

    const rng = mulberry32(hashStringToSeed(`${activityId}_end`))
    // Only a public scene (a night out, a premiere, ...) gets public reactions.
    const activityPublicity = resolvePublicity(activity.description, activity.tags, rng())
    const activityIsPublic = activityPublicity.isPublic
    const statDeltas = statDeltasForTags(rng, activity.tags).filter((e) => activityIsPublic || e.type !== 'followers')
    const nextPlayer = {
      ...applyPlayerEffects(state.player, statDeltas),
      ...lastStatChangesFromEffects(statDeltas, activity.description, Date.now()),
    }
    const followerDelta = statDeltas
      .filter((e) => e.type === 'followers')
      .reduce((sum, e) => sum + e.delta, 0)
    if (followerDelta !== 0) {
      const playerProfile = updatedProfiles[PLAYER_ID] as Profile
      updatedProfiles[PLAYER_ID] = {
        ...playerProfile,
        followers: Math.max(0, playerProfile.followers + followerDelta),
        lastFollowerChange: { delta: followerDelta, reason: activity.description, at: Date.now() },
      }
    }

    const names = participants.map((p) => p.displayName).join(' and ')
    const outcomeSummary = names ? `Spent time with ${names}. Things went well.` : 'Activity complete.'

    const logEntry: ActivityLogEntry = {
      id: makeId('log'),
      at: Date.now(),
      action: 'activity',
      deltas: statDeltas,
      summary: `Activity: "${activity.description}"${names ? ` with ${names}` : ''}`,
    }

    const report: OutcomeReport = {
      kind: 'activity',
      xpGained: xpFromEffects(statDeltas),
      statDeltas,
      followerDelta,
      relationshipChanges: participants.map((npc) => ({ npcId: npc.id, delta: relationshipDelta })),
      reason: outcomeSummary,
      details: {
        summary: `${outcomeSummary} "${activity.description}" ran ${activity.turnCount} ${activity.turnCount === 1 ? 'turn' : 'turns'}${participants.length > 0 ? ` with ${participants.map((p) => p.displayName).join(' and ')}` : ''}.`,
        statReasons: explainStatDeltas(
          activity.tags,
          statDeltas,
          'activity',
          `People heard about "${activity.description}" and it moved your audience.`,
          followerDelta,
        ),
        relationships: activityRelationships,
        signals: activity.tags,
        buzz: activityIsPublic
          ? `${activityPublicity.leaked ? 'Somehow the paparazzi found out. ' : ''}${pickMediaOutlet(Object.values(state.profiles).filter(isNPC))?.displayName ?? 'The tabloids'} ran a story about this — look for it in the feed and in the comments around it.`
          : 'This stayed between the people there — no followers gained and nothing in the news.',
      },
    }

    set({
      profiles: updatedProfiles,
      player: nextPlayer,
      activities: {
        ...state.activities,
        [activityId]: { ...activity, status: 'ended', endedAt: Date.now(), outcomeSummary },
      },
      activityLog: [...state.activityLog, logEntry],
      lastOutcomeReport: report,
    })
    advanceDay()

    const romantic = activity.tags.includes('relationship') || /date|romantic|dinner for two|kiss|flirt/i.test(activity.description)
    if (activityIsPublic) celebResponds({ kind: 'activity', npcIds: participants.map((p) => p.id), detail: activity.description, chance: 0.5 })
    else if (romantic) celebResponds({ kind: 'activity', npcIds: participants.map((p) => p.id), detail: activity.description, chance: 0.4, secret: true })

    // Public scenes make the news and people comment on them; private ones don't.
    if (activityIsPublic)
    runGossip({
      kind: 'activity',
      playerName: (state.profiles[PLAYER_ID] as Profile).displayName,
      detail: activity.description,
      tags: activity.tags,
      others: participants.map((p) => p.displayName),
    })
  },

  // Generates the situation with AI when configured (grounded in recent
  // posts/activities/events — see ai/eventService.ts), falling back to the
  // fixed prompt pool instantly when AI is off/unconfigured/over budget.
  // The fallback is always precomputed, even on the AI path, in case the
  // call fails.
  triggerRandomEncounter: () => {
    if (msUntilNextEvent() > 0) return false
    const state = get()
    const circle = Object.values(state.profiles).filter(isNPC).filter((n) => n.followedByPlayer)
    const rng = mulberry32(hashStringToSeed(`event_${Date.now()}`))
    const celeb = circle.length > 0 && rng() < 0.5 ? pick(rng, circle) : undefined
    const fallbackPrompt = pickPrompt(rng, !!celeb)
    const fallbackText = fallbackPrompt.text.replace('{celeb}', celeb?.displayName ?? 'someone')
    const encounterId = makeId('event')

    const config = state.settings.aiEnabled ? getProviderConfig(state.settings.activeProviderId) : undefined
    const aiOk = !!config && canSpend(config.id, config.rpdBudget)
    recordEventTriggered()

    if (!aiOk) {
      set({
        activeEncounter: {
          id: encounterId,
          text: fallbackText,
          loading: false,
          celebId: celeb?.id,
          choices: fallbackPrompt.choices,
        },
      })
      return true
    }

    set({
      activeEncounter: { id: encounterId, text: '', loading: true, celebId: celeb?.id, choices: [] },
    })

    const playerProfile = state.profiles[PLAYER_ID] as Profile
    const pack = CAREER_PACKS[state.player.career]
    const orgName = state.player.club || pack.worldName

    void generateAiEncounter({
      playerDisplayName: playerProfile.displayName,
      orgName,
      recentActivity: state.activityLog,
      celeb: celeb ?? null,
      config,
    }).then((generated) => {
      set((s) => {
        if (!s.activeEncounter || s.activeEncounter.id !== encounterId) return s
        if (generated) {
          recordSpend(config.id)
          return { activeEncounter: { ...s.activeEncounter, text: generated.text, choices: generated.choices, loading: false } }
        }
        return {
          activeEncounter: { ...s.activeEncounter, text: fallbackText, choices: fallbackPrompt.choices, loading: false },
        }
      })
    })

    return true
  },

  resolveEncounterChoice: (choiceId) => {
    const encounter = get().activeEncounter
    if (!encounter || encounter.resolution || encounter.loading) return
    const choice = encounter.choices.find((c) => c.id === choiceId)
    if (!choice) return
    finishEncounter(choice)
  },

  resolveEncounterCustom: (text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const encounter = get().activeEncounter
    if (!encounter || encounter.resolution || encounter.loading) return
    // A freely-typed response carries the same variance as a "bold" choice
    // — improvising has no built-in safety net.
    finishEncounter({ id: 'custom', label: trimmed, risk: 'bold' })
  },

  dismissEncounter: () => set({ activeEncounter: null }),

  // Comments no longer go through this queue at all — see processComments
  // (called directly from submitPlayerPost) — so this is DM-only: their
  // deliberate "typing" delay, unlike the now-instant comment path.
  // Activities never auto-start either — see startActivity.
  tickScheduler: (now = Date.now()) => {
    const { due, remaining } = splitDueItems(get().scheduled, now)
    if (due.length === 0) return

    set((state) => {
      let threads = state.threads
      for (const item of due) {
        if (item.kind !== 'dm') continue
        const payload = item.payload as DMSchedulePayload
        const thread = threads[payload.npcId]
        if (!thread) continue

        const npcMsg: DMMessage = {
          id: makeId('msg'),
          from: 'npc',
          text: payload.text,
          at: item.dueAt,
          origin: 'template',
        }
        threads = {
          ...threads,
          [payload.npcId]: {
            ...thread,
            messages: [...thread.messages, npcMsg],
            unread: thread.unread + 1,
          },
        }
      }
      return { scheduled: remaining, threads }
    })
  },

  setTheme: (theme) => set((state) => ({ settings: { ...state.settings, theme } })),
  setAiEnabled: (aiEnabled) => set((state) => ({ settings: { ...state.settings, aiEnabled } })),
  setActiveProviderId: (activeProviderId) =>
    set((state) => ({ settings: { ...state.settings, activeProviderId } })),
  setWorldSettings: (patch) =>
    set((state) => ({ worldSettings: { ...state.worldSettings, ...patch } })),

  hydrateFromSave: (save) => {
    // The universe no longer has predetermined roles: an older save's
    // teammate/coach/agent/rival becomes a plain celebrity who speaks in
    // career-agnostic (or AI, in-character) voice instead of the sport pool.
    const LEGACY_ROLES: NPC['persona'][] = ['teammate', 'coach', 'agent', 'rival']
    const profiles: typeof save.profiles = {}
    for (const [id, profile] of Object.entries(save.profiles)) {
      profiles[id] =
        isNPC(profile) && LEGACY_ROLES.includes(profile.persona)
          ? { ...profile, persona: 'celebrity', offTopic: true, vibe: 'friend' }
          : profile
    }
    // Replies saved before replies were guaranteed engagement (or created by
    // paths that never gave them any) sit at 0 likes — backfill them once,
    // deterministically per reply id, so they look like the rest.
    const posts: Record<string, Post> = {}
    for (const [id, post] of Object.entries(save.posts)) {
      if (post.kind === 'reply' && post.likes === 0 && post.reposts === 0) {
        const engagement = estimateReplyEngagement(
          mulberry32(hashStringToSeed(`${id}_engagement`)),
          profiles[post.authorId]?.followers ?? 0,
          (save.player.humor + save.player.aura) / 2,
        )
        posts[id] = { ...post, likes: engagement.likes, reposts: engagement.reposts }
      } else {
        posts[id] = post
      }
    }

    // Live stories that never got any comments (older saves, or the old
    // 0-8 roll landing on 0 even for a huge celeb) get a follower-scaled
    // batch now, same generator as a fresh seed.
    const now = Date.now()
    const hasChildren = new Set(Object.values(save.posts).map((p) => p.parentId).filter(Boolean))
    const commentless = Object.values(posts).filter(
      (p) => p.kind === 'story' && p.authorId !== PLAYER_ID && (p.expiresAt ?? 0) > now && !hasChildren.has(p.id),
    )
    if (commentless.length > 0) {
      const pack = CAREER_PACKS[save.player.career]
      const npcRecord: Record<string, NPC> = {}
      for (const p of Object.values(profiles)) if (isNPC(p)) npcRecord[p.id] = p
      const rng = mulberry32(hashStringToSeed(`story_backfill_${save.clock}_${commentless.length}`))
      const withCounts = commentless.map((s) => ({
        ...s,
        replies: storyCommentCount(rng, npcRecord[s.authorId]?.followers ?? 0),
      }))
      for (const s of withCounts) posts[s.id] = s
      for (const c of seedReplies(pack, rng, npcRecord, withCounts, save.player.club || pack.worldName)) posts[c.id] = c
    }

    set({
      clock: save.clock,
      gameDay: save.gameDay ?? 1,
      player: save.player,
      profiles,
      posts,
      postOrder: Object.values(posts)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => p.id),
      threads: save.threads,
      aiTyping: [],
      scheduled: save.scheduled,
      settings: save.settings,
      activityLog: save.activityLog,
      undoStack: save.undoStack,
      worldSettings: save.worldSettings,
      achievements: save.achievements,
      mutedAccounts: save.mutedAccounts,
      worldStories: save.worldStories ?? [],
      activities: save.activities,
      activeEncounter: null,
      onboarded: save.onboarded,
      lastOutcomeReport: null,
    })
    void hydrateKnowledge()
  },

  resetWorld: () => {
    // Reset sends the player back through onboarding so they can pick a
    // fresh career/profile, rather than silently respawning the same one.
    set({
      ...buildInitialState(BOOTSTRAP_INPUT),
      clock: Date.now(),
      threads: {},
      aiTyping: [],
      scheduled: [],
      settings: defaultSettings(),
      activityLog: [],
      undoStack: [],
      worldSettings: defaultWorldSettings(),
      achievements: [],
      mutedAccounts: [],
      worldStories: [],
      activities: {},
      activeEncounter: null,
      onboarded: false,
      lastOutcomeReport: null,
    })
  },

  toSaveGame: () => {
    const state = get()
    return {
      version: SAVE_VERSION,
      clock: state.clock,
      gameDay: state.gameDay,
      player: state.player,
      profiles: state.profiles,
      posts: state.posts,
      threads: state.threads,
      scheduled: state.scheduled,
      settings: state.settings,
      activityLog: state.activityLog,
      undoStack: state.undoStack,
      worldSettings: state.worldSettings,
      achievements: state.achievements,
      mutedAccounts: state.mutedAccounts,
      worldStories: state.worldStories,
      activities: state.activities,
      onboarded: state.onboarded,
    }
  },
  }
})

export function getPlayerProfile(state: GameState): Profile {
  return state.profiles[PLAYER_ID] as Profile
}

export { PLAYER_ID }
