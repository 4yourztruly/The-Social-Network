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
  RelationshipVibe,
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
  seedReplies,
  type OnboardingInput,
} from '../content/seed'
import { inferPersonaFromBio } from '../engine/personaInference'
import { isDmAvailable, isFollowable, isViewableProfile, tierForPersona } from '../engine/npcTier'
import { CAREER_PACKS } from '../content/careers'
import type { NPCSeed } from '../content/careers/types'
import { buildFallbackRoster } from '../content/rosterFallback'
import { generateRoster } from '../ai/rosterService'
import { isNPC } from '../types'
import { makeId } from '../engine/id'
import { hashStringToSeed, mulberry32, pick, randomInt } from '../engine/rng'
import { createGameEvent } from '../engine/events'
import { applyPlayerEffects, lastStatChangesFromEffects } from '../engine/effects'
import { statDeltasForTags } from '../engine/formulas'
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
import { generateDmReply, type DMSchedulePayload } from '../engine/dm'
import { buildUsernameIndex, extractMentionedIds } from '../engine/mentions'
import { fillTemplate } from '../engine/templates/filler'
import { pushRecentLine, selectLine } from '../engine/templates/select'
import { applyPersonalityVoice } from '../engine/voice'
import {
  ACTIVITY_CHOICES,
  computeRsvp,
  coverageChance,
  pickMediaOutlet,
  templatedActivityBeat,
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
import { generateAiComment } from '../ai/commentService'
import { generateActivityTurn, generateMediaCoverage } from '../ai/activityService'
import { generateAiEncounter, generateAiEncounterOutcome } from '../ai/eventService'
import { getProviderConfig, loadProviderConfigs } from '../ai/keyStorage'
import { canSpend, recordSpend } from '../ai/budget'

const STORY_TTL_MS = 24 * 60 * 60 * 1000

export const SAVE_VERSION = 6

export interface PostOutcome {
  postId: string
  statDeltas: Effect[]
  followerDelta: number
  commentCount: number
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
  // In-game "Day" counter shown in the header — advances on player actions
  // (a post, starting an activity, a random event triggering), not on real
  // wall-clock time. Each advance also drops a small batch of fresh NPC
  // posts into the feed — see advanceDay().
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
  activities: Record<string, Activity>
  activeEncounter: RandomEncounter | null
  onboarded: boolean

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
  submitPlayerPost: (input: { caption: string }) => PostOutcome
  addPlayerReply: (parentId: string, text: string) => void
  submitPlayerStory: (caption: string) => void
  tickScheduler: (now?: number) => void

  // DMs
  sendPlayerMessage: (npcId: string, text: string) => void
  markThreadRead: (npcId: string) => void

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
  // Start the player following the org's own teammates + coach/mentor by default.
  for (const profile of Object.values(world.profiles)) {
    if (isNPC(profile) && (profile.persona === 'teammate' || profile.persona === 'coach')) {
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

export const useGameStore = create<GameState>((set, get) => {
  // Advances the in-game "Day" counter and drops a fresh batch of NPC posts
  // (plus their replies) into the feed — called whenever the player does
  // something that "counts as a day": posting, starting an activity, or a
  // random event firing. Not tied to real wall-clock time at all.
  function advanceDay() {
    set((state) => {
      const pack = CAREER_PACKS[state.player.career]
      const npcs: Record<string, NPC> = {}
      for (const profile of Object.values(state.profiles)) {
        if (isNPC(profile)) npcs[profile.id] = profile
      }
      const rng = mulberry32(hashStringToSeed(`day_${state.gameDay}_${state.clock}_${Object.keys(state.posts).length}`))
      const orgForFlavor = state.player.club || pack.worldName
      const dailyPosts = seedDailyPosts(pack, rng, npcs, DAILY_POST_COUNT, orgForFlavor)
      const dailyReplies = seedReplies(pack, rng, npcs, dailyPosts, orgForFlavor)
      const newItems = [...dailyPosts, ...dailyReplies].sort((a, b) => b.createdAt - a.createdAt)

      const posts = { ...state.posts }
      for (const post of newItems) posts[post.id] = post

      return {
        gameDay: state.gameDay + 1,
        posts,
        postOrder: [...newItems.map((p) => p.id), ...state.postOrder],
      }
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
      const commentPost: Post = {
        id: commentPostId,
        authorId: payload.npcId,
        kind: 'reply',
        parentId: payload.parentPostId,
        text,
        tags: payload.tags,
        createdAt: dueAt,
        likes: 0,
        reposts: 0,
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
  }

  // Materializes every comment in the batch as fast as possible: instantly
  // for the deterministic path, or as soon as its AI network call resolves
  // for aiEligible ones (spec section 8, "gameplay never blocks on AI" —
  // any failure falls straight back to the already-computed template text).
  function processComments(items: readonly ScheduledCommentItem[]) {
    if (items.length === 0) return
    const state = get()
    const aiConfig = state.settings.aiEnabled ? getProviderConfig(state.settings.activeProviderId) : undefined
    const aiBudgetOk = !!aiConfig && canSpend(aiConfig.id, aiConfig.rpdBudget)

    for (const item of items) {
      const payload = item.payload
      const npc = aiConfig && aiBudgetOk ? get().profiles[payload.npcId] : undefined
      if (!payload.aiEligible || !aiConfig || !aiBudgetOk || !npc || !isNPC(npc)) {
        materializeComment(payload, payload.text, item.dueAt, 'template')
        continue
      }

      const snapshot = get()
      const playerProfile = snapshot.profiles[PLAYER_ID] as Profile
      const pack = CAREER_PACKS[snapshot.player.career]

      void generateAiComment({
        npc,
        playerDisplayName: playerProfile.displayName,
        orgName: snapshot.player.club || pack.worldName,
        postText: snapshot.posts[payload.parentPostId]?.text ?? '',
        recentActivity: snapshot.activityLog,
        config: aiConfig,
      }).then((aiText) => {
        if (aiText) {
          recordSpend(aiConfig.id)
          materializeComment(payload, aiText, item.dueAt, 'ai')
        } else {
          materializeComment(payload, payload.text, item.dueAt, 'template')
        }
      })
    }
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
  function advanceActivity(activityId: string, isOpening: boolean) {
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
      : templatedActivityBeat(
          mulberry32(hashStringToSeed(`${activityId}_${activity.messages.length}`)),
          activity.messages.at(-1)?.text ?? '',
          participants,
        )
    const fallbackChoices = ACTIVITY_CHOICES

    if (!aiEligible) {
      appendActivityMessage(activityId, fallbackText, 'template', fallbackChoices)
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
    }).then((turn) => {
      set((s) => ({ aiTyping: s.aiTyping.filter((id) => id !== activityId) }))
      if (turn) {
        recordSpend(config.id)
        appendActivityMessage(activityId, turn.beat, 'ai', turn.choices)
      } else {
        appendActivityMessage(activityId, fallbackText, 'template', fallbackChoices)
      }
    })
  }

  // A media outlet NPC posts a standalone top-level post about a leaked
  // activity — "tabloids post about rumours, paparazzi can catch you."
  // Reuses the exact same template pipeline as post comments, just
  // materialized as its own post instead of a reply.
  function triggerMediaCoverage(outlet: NPC, description: string, tags: string[]) {
    const state = get()
    const pack = CAREER_PACKS[state.player.career]
    const playerProfile = state.profiles[PLAYER_ID] as Profile
    const rng = mulberry32(hashStringToSeed(`${outlet.id}_${Date.now()}_coverage`))
    const linePool = pack.reactionPool[outlet.persona]
    const selection = selectLine(rng, linePool, tags, outlet.recentLineIds)
    const filled = fillTemplate(selection.line, {
      player: playerProfile.displayName,
      org: state.player.club || pack.worldName,
    })
    const fallbackText = applyPersonalityVoice(filled, outlet, rng)

    set((s) => ({
      profiles: {
        ...s.profiles,
        [outlet.id]: { ...outlet, recentLineIds: pushRecentLine(outlet.recentLineIds, selection.lineId) },
      },
    }))

    function materializeCoveragePost(text: string, origin: Post['origin']) {
      set((s) => {
        const post: Post = {
          id: makeId('post'),
          authorId: outlet.id,
          kind: 'post',
          text,
          tags,
          createdAt: Date.now(),
          likes: 0,
          reposts: 0,
          replies: 0,
          origin,
        }
        return { posts: { ...s.posts, [post.id]: post }, postOrder: [post.id, ...s.postOrder] }
      })
    }

    const config = state.settings.aiEnabled ? getProviderConfig(state.settings.activeProviderId) : undefined
    const aiEligible = !!config && canSpend(config.id, config.rpdBudget)
    if (!aiEligible) {
      materializeCoveragePost(fallbackText, 'template')
      return
    }

    void generateMediaCoverage({
      npc: outlet,
      description,
      playerDisplayName: playerProfile.displayName,
      config,
    }).then((aiText) => {
      if (aiText) {
        recordSpend(config.id)
        materializeCoveragePost(aiText, 'ai')
      } else {
        materializeCoveragePost(fallbackText, 'template')
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

    const rng = mulberry32(hashStringToSeed(`${encounterId}_resolve_${choice.id}_${Date.now()}`))
    const tier = rollTier(rng, choice.risk)
    const playerProfile = state.profiles[PLAYER_ID] as Profile
    const outcome = tierOutcome(tier, playerProfile.followers)
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
      set((s) => ({ activityLog: [...s.activityLog, logEntry] }))

      // A bad outcome can leak to the tabloids, same as a risky Activity —
      // only when it's actually newsworthy (see coverageChance), never guaranteed.
      if (outcome.tags.length > 0) {
        const chance = coverageChance(outcome.tags, 3)
        if (chance > 0 && rng() < chance) {
          const npcs = Object.values(get().profiles).filter(isNPC)
          const outlet = pickMediaOutlet(npcs)
          if (outlet) triggerMediaCoverage(outlet, encounterText, outcome.tags)
        }
      }
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
  activities: {},
  activeEncounter: null,
  onboarded: false,

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

    let npcSeeds: NPCSeed[] | undefined
    if (aiEligible) {
      const generated = await generateRoster({ input, pack, config })
      if (generated) {
        recordSpend(config.id)
        npcSeeds = generated
      }
    }
    if (!npcSeeds) {
      const rng = mulberry32(hashStringToSeed(`${input.username}_roster`))
      npcSeeds = buildFallbackRoster(pack, input, rng)
    }

    const world = buildInitialState(input, npcSeeds)
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
      activities: {},
      activeEncounter: null,
      onboarded: true,
    })
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
    const startingRelationshipByVibe: Record<RelationshipVibe, number> = {
      friend: 40,
      rival: -30,
      mentor: 30,
      teammate_bond: 40,
      fan: 20,
      romantic: 50,
      frenemy: -10,
    }

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
      verified: false,
      followers: input.followers && input.followers > 0 ? Math.round(input.followers) : randomInt(rng, 500, 50_000),
      following: randomInt(rng, 50, 500),
      joinedAt: now,
      isPlayer: false,
      persona,
      personality: [],
      relationship: startingRelationshipByVibe[vibe],
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
    }

    set((state) => {
      const profiles = { ...state.profiles, [id]: npc }
      const playerProfile = state.profiles[PLAYER_ID] as Profile
      const followingCount = Object.values(profiles).filter((p) => isNPC(p) && p.followedByPlayer).length

      // Give them one live story right away, in the same voice/content pool
      // as the rest of the roster — reuses seedPostPool, no new content
      // needed. Commenter-tier people never author their own posts/stories.
      const pack = CAREER_PACKS[state.player.career]
      const lines = isViewableProfile(npc) ? pack.seedPostPool[persona] : undefined
      let posts = state.posts
      let postOrder = state.postOrder
      if (lines && lines.length > 0) {
        const line = pick(rng, lines)
        const text = fillTemplate(line, { org: state.player.club || pack.worldName, org_upper: (state.player.club || pack.worldName).toUpperCase() })
        const story: Post = {
          id: makeId('post'),
          authorId: id,
          kind: 'story',
          text,
          tags: [],
          createdAt: now,
          expiresAt: now + STORY_TTL_MS,
          likes: 0,
          reposts: 0,
          replies: 0,
          origin: 'template',
        }
        posts = { ...posts, [story.id]: story }
        postOrder = [story.id, ...postOrder]
      }

      return {
        profiles: { ...profiles, [PLAYER_ID]: { ...playerProfile, following: followingCount } },
        posts,
        postOrder,
      }
    })

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

  addPlayerReply: (parentId, text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    set((state) => {
      const parent = state.posts[parentId]
      if (!parent) return state
      const reply: Post = {
        id: makeId('post'),
        authorId: PLAYER_ID,
        kind: 'reply',
        parentId,
        text: trimmed,
        tags: [],
        createdAt: Date.now(),
        likes: 0,
        reposts: 0,
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
    for (const npcId of mentionedIds) {
      const npc = updatedProfiles[npcId]
      if (npc && isNPC(npc)) {
        updatedProfiles[npcId] = {
          ...npc,
          relationship: Math.min(100, npc.relationship + 2),
          lastRelationshipChange: { delta: 2, reason: 'You tagged them in a post.', at: now },
        }
      }
    }

    const logEntry: ActivityLogEntry = {
      id: makeId('log'),
      at: now,
      action: 'post',
      eventId: event.id,
      deltas: result.statDeltas,
      summary: `Posted: "${text.length > 60 ? `${text.slice(0, 60)}…` : text}"`,
    }

    set({
      posts: { ...state.posts, [post.id]: post },
      postOrder: [post.id, ...state.postOrder],
      profiles: updatedProfiles,
      player: nextPlayer,
      activityLog: [...state.activityLog, logEntry],
    })

    // Comments materialize as fast as possible — instantly for the
    // deterministic path, or as soon as each AI call resolves — rather than
    // trickling in through the scheduled-item/tick mechanism (which is
    // still used for DMs' deliberate typing delay).
    processComments(commentItems)
    advanceDay()

    return {
      postId: post.id,
      statDeltas: result.statDeltas,
      followerDelta: result.followerDelta,
      commentCount: commentItems.length,
    }
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
    set((s) => ({
      activities: { ...s.activities, [activityId]: { ...activity, status: 'active', rsvps } },
    }))
    advanceDay()
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
    const ACTIVITY_TURN_CAP = 4

    set((state) => {
      const activity = state.activities[activityId]
      if (!activity || activity.status !== 'active') return state
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
    if (!activity) return
    if (activity.turnCount >= ACTIVITY_TURN_CAP) {
      get().endActivity(activityId)
      return
    }
    advanceActivity(activityId, false)
  },

  endActivity: (activityId) => {
    const state = get()
    const activity = state.activities[activityId]
    if (!activity || activity.status === 'ended') return

    const participants = activity.participantIds
      .map((id) => state.profiles[id])
      .filter((p): p is NPC => !!p && isNPC(p))
    // Spending time together is inherently relationship-positive here —
    // longer scenes (more turns) matter more, capped so one activity can't
    // max out a relationship on its own.
    const relationshipDelta = Math.min(15, 5 + activity.turnCount * 2)

    const updatedProfiles = { ...state.profiles }
    for (const npc of participants) {
      updatedProfiles[npc.id] = {
        ...npc,
        relationship: Math.max(-100, Math.min(100, npc.relationship + relationshipDelta)),
        lastRelationshipChange: { delta: relationshipDelta, reason: activity.description, at: Date.now() },
      }
    }

    const rng = mulberry32(hashStringToSeed(`${activityId}_end`))
    const statDeltas = statDeltasForTags(rng, activity.tags)
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

    set({
      profiles: updatedProfiles,
      player: nextPlayer,
      activities: {
        ...state.activities,
        [activityId]: { ...activity, status: 'ended', endedAt: Date.now(), outcomeSummary },
      },
      activityLog: [...state.activityLog, logEntry],
    })

    // Maybe the tabloids catch wind of it — only for activities that were
    // actually newsworthy (see coverageChance), never guaranteed.
    const chance = coverageChance(activity.tags, activity.turnCount)
    if (chance > 0 && rng() < chance) {
      const npcs = Object.values(get().profiles).filter(isNPC)
      const outlet = pickMediaOutlet(npcs)
      if (outlet) triggerMediaCoverage(outlet, activity.description, activity.tags)
    }
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
    advanceDay()

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
    set({
      clock: save.clock,
      gameDay: save.gameDay ?? 1,
      player: save.player,
      profiles: save.profiles,
      posts: save.posts,
      postOrder: Object.values(save.posts)
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
      activities: save.activities,
      activeEncounter: null,
      onboarded: save.onboarded,
    })
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
      activities: {},
      activeEncounter: null,
      onboarded: false,
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
