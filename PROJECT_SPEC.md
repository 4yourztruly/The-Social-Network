# Football Social Life Sim: Project Spec

> Hand this file to Claude Code as the source of truth. Build milestone by milestone (see section 14). Ask before adding dependencies that are not listed here.

## 1. Overview

A web-based **social media life sim** built with **React + TypeScript**. The player is a professional footballer with a Twitter/X-style profile (username, display name, bio, avatar, followers, following, posts). They live inside a feed populated by NPCs: teammates, fans, journalists, rivals, a transfer insider and a tabloid.

The player can:

- Post to the feed and post stories
- Reply to posts and comments
- DM NPCs
- Create **events** (a match, a party, a press conference, a contract negotiation). The player sets up the event, then plays it as a short branching story with choices and an ending.

The world reacts. Fans comment on posts, journalists write about posts and events, insiders and tabloids cover the results, and NPCs DM the player. Everything reacts to one shared structure: the **GameEvent** (section 5).

**Context:** personal project for a single player. No monetization, no multiplayer, no backend.

## 2. Hard constraints

1. **Free to build, host and play.** Static hosting only. No backend, no database, no paid infrastructure.
2. **Must run smoothly on desktop and iPhone (Safari).** No lag. See section 9.
3. **Fully playable offline without AI.** The template content system is the foundation. AI is an optional enhancement layered on top.
4. **No secrets in the repo or the bundle.** The AI key is entered by the user in a settings screen and stored in `localStorage` on that device only. No proxy or Worker is needed for v1.
5. **TypeScript strict mode.** Types in `src/types` are the source of truth.
6. **Game logic is deterministic code.** AI only writes words. Relationship, fame, morale and event outcomes are always decided by code.
7. **AI must be 100% free, always.** No paid APIs, no billing account attached to any key, no credit card, no pay-per-token, no expiring trial credits. See the "Free-only policy" in section 8. If free AI is unavailable (rate-limited, offline, provider changes its tier), the game silently uses templates.

## 3. Tech stack

**Required stack:** React + TypeScript (strict), Tailwind CSS, Zustand. Everything else below supports those. Do not swap these out.

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict), Vite |
| State | Zustand (with selectors), normalized entities |
| Persistence | IndexedDB via Dexie |
| Feed rendering | TanStack Virtual (virtualized list) |
| Validation | zod (AI output, save files, content JSON) |
| PWA | vite-plugin-pwa (manifest + service worker) |
| Styling | **Tailwind CSS** (v4 with the Vite plugin, or v3 if tooling requires). Use utility classes, a small set of shared design tokens (colors, radii, spacing) in the Tailwind config/theme, and support dark mode. Prefer `transform`/`opacity` animations. |
| Tests | Vitest (reaction engine, scheduler, template filler) |
| Heavy sim | Web Worker only if profiling shows jank |
| AI transport | Plain `fetch` with `AbortController` (no heavy provider SDKs, to keep the iPhone bundle small) |
| AI streaming | `eventsource-parser` (or a small hand-written SSE reader) for streamed DM replies |
| AI output validation | zod (already listed). Optionally `zod-to-json-schema` if a provider supports JSON-schema structured output |
| AI key/settings | `localStorage` wrapped in a small typed helper (never IndexedDB exports, never the repo) |

### AI dependency guidance

- **Prefer one generic OpenAI-compatible adapter.** Many free-tier providers and Ollama expose an OpenAI-style `/chat/completions` endpoint. One adapter configured with `baseUrl`, `apiKey` and `model` can cover several of them. Add a dedicated adapter only when a provider needs it (e.g. a different request format).
- **Avoid large SDKs** (`openai`, `@google/genai`, Vercel `ai`, LangChain). They add bundle weight and hide behavior, which matters for iPhone performance. Use `fetch`.
- **Test browser access early.** Calling providers directly from the browser depends on their CORS support. The settings screen's "Test connection" button must surface a clear error if a provider blocks browser requests, and the README should note which providers were verified to work.
- Keep all AI code behind the `AIProvider` interface (section 8) and **lazy-load the `ai/` module** so it is not in the initial bundle when AI is disabled.

## 4. Features

### 4.1 Profile (Twitter-like)

The player profile and every NPC profile share one shape.

- Display name, `@username`, bio, avatar (initials, SVG or small WebP), verified badge, join date
- **Followers** and **following** counts. Follower growth is driven by fame, performance and viral posts. Following is player-controlled (follow/unfollow NPCs).
- Post count, pinned post, list of the person's posts/replies
- Player-only stats: club, position, ratings (finishing, passing, etc.), fame, morale, form, reputation traits
- Profile page: header, stats row, tabs (Posts, Replies, Stories highlights)

### 4.2 Feed

- Home timeline mixing NPC posts and the player's posts. Chronological by game time, with light weighting toward followed accounts and recent events.
- **Stories row** at the top (avatar rings). Stories expire after 24 game-hours. Tapping opens a simple viewer.
- Post card: avatar, name, handle, verified badge, relative time, text, like/repost/reply counts, optional media placeholder. Tap opens the thread.
- Infinite scroll, **virtualized**.

### 4.3 Composer (structured)

Do **not** try to understand arbitrary free text with code alone. The composer captures structure plus flavor:

- Post type: `match_reaction | training | personal | controversial | humble_brag | thanks | banter | announcement`
- Optional attachments: a match, a teammate to tag, a mood/tone (`humble | cocky | emotional | funny`)
- Optional caption (free text). A **keyword tagger** scans the caption (e.g. "goal", "injured", "leaving", "referee") to add extra tags.
- Same composer flow for stories.
- When AI is enabled, the caption is sent to the AI as context. When AI is off, only the structure and keyword tags drive reactions.

### 4.4 Comments and replies

- When the player posts, the reaction engine schedules 5-15 comments from NPCs, with **staggered timestamps** so they trickle in.
- Each commenter has a persona (loyal fan, hater, rival, teammate, meme account, etc.) that filters which lines they can use.
- The player can reply to any comment or post. NPCs may reply back (max 2 levels of threading).
- Comments reference specifics from the event data (goals, opponent, minute).

### 4.5 Journalist / media posts

Media accounts react to events and posts with a **delay**:

- **Match reporter:** match reports, ratings, player-of-the-match posts.
- **Transfer insider (parody persona, Romano-style):** staged stories (rumor → talks ongoing → "here we go" / collapses). Stage advances based on the player's choices in negotiation scenes, over game days.
- **Tabloid (parody persona, TMZ-style):** reacts to `party`, `scandal`, `relationship`, `controversial` tags, gated by fame. Has a **leak chance**: risky party choices may cause "photos surface" a day later.
- Media can also react to the player's **posts** (e.g. a controversial post becomes a "star sparks debate" article).
- Different personas cover the same event with different tone and headlines.

### 4.6 DMs

- Inbox + thread view, typing indicator (~1-3s), unread badges.
- Each NPC has a **dialogue state machine**: nodes with NPC lines, player reply options, effects (relationship, mood, fame), gated by relationship level.
- **Events trigger DMs:** after a hat-trick the coach messages, a fan writes in, an agent sends an offer.
- **Optional AI mode** for freeform typing (section 8). Default is tappable reply options.

### 4.7 Events (scenes)

The player creates an event from a template, fills in the setup, then plays through it.

Templates: `match`, `party`, `press_conf`, `negotiation` (extensible).

Flow:

1. **Setup:** pick template, customize (opponent, venue, invitees, stakes, opening description).
2. **Opening narration** (template-filled, or AI-written if enabled).
3. **2-4 beats**, each with 2-4 choices. Choices change stats/tags and may include a **roll** (`stat` vs `difficulty`) so outcomes vary run to run.
4. **Ending** narration.
5. On completion, the scene emits a **summary GameEvent** (e.g. `match_performance`, tags `['derby','late_winner','selfish']`, data `{goals: 2, opponent: 'X', minute: 89}`) into the reaction pipeline.

Authoring notes:

- Use **converging branches**: choices modify tags/stats but often rejoin the same next beat, so content stays small.
- With AI enabled, the AI may generate beats and choices as JSON from the player's setup. It must be validated with zod and fall back to the template if invalid.

### 4.8 Time and scheduling

- Game clock advances via player actions ("advance day", finishing an event) and optionally a light real-time tick for delayed items.
- A **scheduler** holds `ScheduledItem`s (comments, media posts, DMs, story expiry) sorted by `dueAt`. On each tick, due items are materialized into the feed/inboxes.
- Generate content in **small batches**, never hundreds at once.

## 5. Core architecture: GameEvent to reactions

Everything (posts, stories, replies, scenes, time passing) produces a `GameEvent`. Reactions are pure functions of event + world state.

```ts
type GameEvent = {
  id: string;
  type:
    | 'player_post' | 'player_story' | 'player_reply'
    | 'match_performance' | 'party' | 'press_conf' | 'negotiation'
    | 'injury' | 'transfer_rumor' | 'scandal_leak';
  tags: string[];                 // ['goals','hat_trick','derby','selfish']
  data: Record<string, unknown>;  // { goals, opponent, minute, ... }
  tone?: 'humble' | 'cocky' | 'emotional' | 'funny';
  sourceId?: string;              // post/scene that caused it
  timestamp: number;              // game time
};
```

Pipeline:

```
Player action / Scene end
        │
        ▼
   GameEvent  ──►  ReactionEngine  ──►  ScheduledItem[]  ──►  Scheduler tick
                        │                                           │
        (rules: tags + fame + personas + RNG)                       ▼
                                                        Feed / Inbox / Notifications
```

- **Reaction rules** are data: `{ whenTags, minFame, personaTypes, delayRange, chance, generator }`.
- **Chain reactions** are just events emitting more events: party (risky choices) → tabloid leak (delay) → fan comment split → coach DM → morale drop.
- The engine must be **unit-tested** with a seeded RNG.

## 6. Data model

```ts
type Persona =
  | 'loyal_fan' | 'hater' | 'rival' | 'teammate' | 'coach' | 'agent'
  | 'meme_account' | 'match_reporter' | 'insider' | 'tabloid';

interface Profile {
  id: string;
  username: string;            // without '@'
  displayName: string;
  bio: string;
  avatar: { kind: 'initials' | 'svg' | 'webp'; value: string };
  verified: boolean;
  followers: number;
  following: number;
  joinedAt: number;
  isPlayer: boolean;
}

interface NPC extends Profile {
  persona: Persona;
  personality: string[];       // ['sarcastic','loyal']
  relationship: number;        // -100..100 with the player
  mood: number;                // -10..10
  postingStyle: { emoji: number; caps: number; hashtags: number };
  recentLineIds: string[];     // anti-repetition ring buffer
  dialogueState?: string;      // DM state machine node id
}

interface Post {
  id: string;
  authorId: string;
  kind: 'post' | 'reply' | 'story';
  parentId?: string;           // for replies
  text: string;
  tags: string[];
  eventId?: string;
  createdAt: number;
  expiresAt?: number;          // stories
  likes: number; reposts: number; replies: number;
  likedByPlayer?: boolean;
  origin: 'template' | 'ai' | 'player';
}

interface DMThread {
  id: string;
  npcId: string;
  messages: { id: string; from: 'player' | 'npc'; text: string; at: number; origin: 'template' | 'ai' | 'player' }[];
  summary?: string;            // rolling summary of older messages for AI context
  unread: number;
}

interface PlayerState {
  profileId: string;
  club: string; position: string;
  ratings: Record<string, number>;   // finishing, passing, pace...
  fame: number; morale: number; form: number;
  traits: string[];                  // 'selfish','team_player','controversial'
}

interface Scene {
  id: string;
  template: 'match' | 'party' | 'press_conf' | 'negotiation';
  setup: Record<string, string>;     // opponent, venue, invitees...
  beats: Beat[];
}
interface Beat {
  id: string;
  text: string;
  choices: {
    label: string;
    effects: Effect[];               // mood, fame, relationship, followers...
    tagsAdded: string[];
    roll?: { stat: string; difficulty: number; onFail?: string };
    next: string | 'end';
  }[];
}

interface ScheduledItem {
  id: string;
  dueAt: number;
  kind: 'post' | 'comment' | 'dm' | 'story_expiry' | 'event';
  payload: unknown;
}

interface SaveGame {
  version: number;                   // for migrations
  clock: number;
  player: PlayerState;
  profiles: Record<string, Profile | NPC>;
  posts: Record<string, Post>;
  threads: Record<string, DMThread>;
  scheduled: ScheduledItem[];
  settings: Settings;
}
```

Store entities **normalized** (records keyed by id) so a like or new comment re-renders one post, not the feed.

## 7. Content system (offline foundation)

**Template pools** shipped as JSON, validated with zod at build/load time:

- Pools are keyed by `(persona, tags, tone)`, e.g. `loyal_fan + goals + hat_trick`.
- Lines use `{variables}` filled from event data: `"{goals} goals?! {opponent} had no chance"`.
- Write many **small variations** rather than a few long lines. Variety comes from combinations (opener + body + emoji + hashtag).
- **Selection algorithm:** filter by persona and tags, weight by personality and relationship, exclude the NPC's `recentLineIds`, pick with seeded RNG.
- Headline templates for media personas, with persona-specific tone and catchphrases.
- Dialogue trees for DMs as JSON state machines.

**Default world is fictional** (a fictional club, players and media parody personas). The world is fully **data-driven** (JSON), so the user can edit or swap names and clubs without code changes.

## 8. AI layer (optional, bring-your-own key)

**Design principle:** code owns state; AI owns wording. AI receives structured context and returns **bounded JSON** that is validated and clamped.

### Free-only policy (mandatory)

The AI feature must cost **$0**, permanently. No billing account, no credit card, no pay-per-token usage, no trial credits that expire.

**Allowed sources**

- **Standing free tiers that need no credit card.** As of Aug/Sept 2026, comparisons list these as having genuine free tiers: Google Gemini API (Flash models), Groq, OpenRouter (free models only), Mistral (free mode), Cloudflare Workers AI (daily free allowance) and SambaNova. Free tiers change often, so re-verify against each provider's own docs before shipping presets. Do not trust this list blindly.
- **Local models via Ollama** (desktop only, unlimited, works only while the desktop is on and reachable). This is the fully free fallback for desktop play.

**Not allowed:** any provider without a standing free tier, any key with billing enabled, and any "free trial credits" offer.

**Implementation rules**

1. **Presets contain only free options.** No paid provider or model appears in the preset dropdown.
2. **OpenRouter guard:** only allow model ids ending in `:free`. Block any other OpenRouter model id client-side with a clear message.
3. **Custom base URL / model:** allowed, but the settings screen shows a warning: "Make sure this endpoint is free. This app cannot verify billing."
4. **Client-side budget limiter.** Per-provider requests-per-minute and requests-per-day budgets, set conservatively (about 50-70% of the published limits). Counters are persisted in `localStorage` and reset daily. When the budget is spent, use templates. Limits are configurable in settings and stored in the provider config file, never hardcoded in logic, because free tiers change.
5. **Failure handling:** on 429 or quota errors, back off once, then fail over to the next configured free provider (if any), then to templates. No retry loops.
6. **Spend AI only where it matters.** Use templates for low-value content (likes, filler comments, routine media). Use AI for high-value moments: the player's own posts, scene generation, and DMs when AI mode is on. Together with batching, caching and persisting outputs (below), this keeps usage far below free limits.
7. **Usage meter:** the settings screen shows AI calls made today vs. the local budget, plus the current AI status (on / limited / off).
8. **README instructions:** tell the user to create keys on each provider's free tier, **not to add billing details or purchase credits**, and to check the provider's current free-tier terms.
9. **Privacy note:** some free tiers may use prompts to improve their models. Prompts must contain only in-game context, never real personal information about the user.

### Key handling

- Settings screen: provider dropdown, API key field, model field, "Test connection" button, AI on/off toggle.
- Key is stored in `localStorage` **on the device only**. It is never in the repo, the bundle, env vars, or the save export.
- Save export/import must **exclude** the key.
- No proxy, no Worker for v1.

### Provider abstraction

```ts
interface AIProvider {
  complete(args: {
    system: string;
    user: string;
    json?: boolean;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<string>;
}
```

Start with a single **OpenAI-compatible adapter** (`baseUrl`, `apiKey`, `model`) that works with free-tier providers such as Groq, OpenRouter free models, Gemini's OpenAI-compatible endpoint, and Ollama for desktop dev. Add a provider-specific adapter only if one needs a different request format. Provider presets (name, default `baseUrl`, suggested model) live in a small config file so the user can pick from a dropdown or enter a custom URL. Free-tier limits and model names change often, so keep providers swappable and make no assumptions about limits.

Support both modes on the interface: a normal completion (for batched JSON like comments) and a **streaming** completion (for DM replies), with `AbortController` cancellation when the user leaves the thread or sends a new message.

### Usage per feature

| Feature | AI usage |
|---|---|
| Comments | **One call per post** returning 8-12 comments as a JSON array (`persona`, `text`, `delayMs`). Never one call per comment. |
| Media posts | One call per event, persona tone in the prompt. |
| DMs | One call per message. Context = character card + relationship + recent events + last ~10 messages + rolling summary. Stream if supported. Show typing indicator. |
| Event scenes | Generate opening + 2-4 beats + choices as JSON from the player's setup, or narrate outcomes of a template scene. |

### Robustness rules

1. **Always fall back to templates** on offline, rate limit, timeout or invalid JSON. Gameplay never blocks on AI.
2. Validate every response with **zod**. Clamp effects (e.g. `moodDelta` in -2..2). Reject unknown tags or fields.
3. **Treat player text as untrusted input in prompts.** It must never be able to change game state directly, only influence wording.
4. Cap `max_tokens`. Batch requests. Debounce. Cache and dedupe identical requests.
5. **Persist AI outputs into the save** so reloads do not re-call the API and the save works offline.
6. Handle 429s with backoff, then silently fall back. Show a small "AI: on / limited / off" indicator.
7. Prefetch likely content (e.g. comments for the next post) in the background while the player reads.

## 9. Performance requirements (iPhone-first)

- **Virtualize** the feed, inbox and long threads.
- `React.memo` on post/comment components. Zustand **selectors** everywhere. No whole-store subscriptions.
- Animations: `transform` and `opacity` only. **Avoid** `backdrop-filter`, large box-shadows and many simultaneously animated elements.
- Lightweight assets: initials or SVG avatars, small WebP only. Lazy-load images.
- **Code-split** screens (chat, events, settings, profile) with `React.lazy`.
- **Debounce** IndexedDB writes (e.g. 500-1000 ms). Never save on every state change.
- Batch content generation (a few items per tick). Use a Web Worker only if profiling justifies it.
- Tap targets at least 44px. Respect safe-area insets. Use `100dvh`, not `100vh`.
- Budget: initial JS bundle as small as practical (target < 250 KB gzipped for the first screen), feed scroll at 60fps on a mid-range iPhone.

## 10. Persistence and saves

- Dexie/IndexedDB as the main store. `SaveGame` is versioned with **migration functions**.
- Call `navigator.storage.persist()` where supported.
- **PWA**: manifest + service worker so the game can be added to the iPhone Home Screen (installed web apps are not subject to Safari's periodic storage cleanup for inactive sites) and played offline.
- **Export/import save** as a JSON file and as a copy-paste code, as a backup. Exclude API keys.
- Provide a "Reset world" option with confirmation.

## 11. Hosting and deployment

- Static build (`npm run build`, output `dist`).
- Deploy from a **private GitHub repo** on a free static host that supports private repos: **Cloudflare Pages** (preferred), Netlify or Vercel. (GitHub Pages on the free plan requires a public repo.)
- The deployed site is public by default. That is acceptable because it contains no secrets and cannot spend anything without the user's locally stored key.
- Document the deploy steps in `README.md`.

## 12. Suggested folder structure

```
src/
  app/                 # routing, layout, providers
  types/               # GameEvent, Profile, Post, Scene, SaveGame, ...
  store/               # zustand slices: world, feed, dm, scenes, settings
  db/                  # dexie setup, save/load, migrations, export/import
  engine/
    events.ts          # GameEvent creation
    reactions/         # rules + generators (comments, media, dm triggers)
    scheduler.ts       # ScheduledItem queue + tick
    rng.ts             # seeded RNG
    templates/         # pool loader, filler, selection, anti-repetition
    dialogue/          # DM state machine runner
    scenes/            # scene runner, rolls, effects
  ai/
    provider.ts        # AIProvider interface
    providers/         # gemini.ts, groq.ts, openrouter.ts, ollama.ts
    prompts/            # system prompt builders per feature
    schemas.ts          # zod schemas for AI output
    service.ts           # batching, caching, fallback, backoff
  features/
    feed/  profile/  composer/  stories/  dm/  events/  settings/
  content/             # JSON: world, npcs, pools, headlines, dialogues, scene templates
  components/          # shared UI (PostCard, Avatar, Badge, ...)
  workers/             # optional sim worker
public/                # icons, manifest
```

## 13. Content and safety notes

- Default content uses **fictional** clubs, players and media personas. Real people's names should not be hard-coded in the repo. Since the world is data-driven, the user can customize locally.
- Keep parody personas clearly fictional (own names, own catchphrases).
- Tone for generated content: football social media banter. No slurs or targeted harassment in template pools or AI prompts. Include a system-prompt rule for AI content.

## 14. Milestones

1. **Skeleton:** Vite + React + TS + Zustand + Dexie + PWA. Player profile, NPC profiles, virtualized feed with seeded NPC posts, follow/unfollow, persistence, export/import.
2. **Composer and comments:** structured composer, keyword tagger, GameEvent creation, reaction engine v1, template pools, staggered comments, likes, replies.
3. **Time and media:** game clock, scheduler, stories with expiry, match reporter / insider / tabloid personas, notifications.
4. **DMs:** inbox, dialogue state machine, event-triggered DMs, typing indicator, relationship effects.
5. **Event scenes:** scene runner, four templates, rolls, converging branches, summary events feeding the pipeline, chain reactions (party → leak → reactions → DM).
6. **AI layer:** provider interface, settings screen, one adapter first, comment batching, DM chat, scene generation, zod validation, fallbacks, caching, persisted outputs.
7. **Polish and perf:** profiling on a real iPhone, bundle splitting, content variety pass, anti-repetition tuning, tests, README and deploy docs.

## 15. Acceptance criteria (definition of done)

- Game is fully playable **with AI disabled** and with no network.
- Posting produces staggered comments that reference the post's structured data.
- A match scene ends by emitting a summary event; a match report and fan reactions appear afterward; a DM may follow.
- A risky party scene can trigger a delayed tabloid leak, which produces reactions and a morale/relationship change.
- The transfer insider's story advances through stages based on negotiation choices.
- With AI enabled, invalid or failed responses silently fall back to templates.
- No preset, default or code path can incur AI costs: only free-tier providers/models are offered, OpenRouter ids are restricted to `:free`, and the client-side budget limiter stops calls before free limits are hit.
- When the daily AI budget is exhausted or the provider returns 429, the game continues seamlessly on templates with the status indicator showing "limited".
- The API key exists only in `localStorage`, and is absent from the bundle, repo and save exports.
- Scrolling a 1,000+ post feed stays smooth on iPhone Safari.
- Reloading or reopening the PWA restores the exact game state.

## 16. Working notes for Claude Code

- Start with `src/types` and the reaction-engine interfaces. Everything else depends on them.
- Keep pure logic (engine, scheduler, templates) free of React so it can be unit-tested with a seeded RNG.
- Prefer small, composable content JSON over hard-coded strings in components.
- After each milestone: run typecheck, lint and tests, then profile the feed on a mobile viewport.
- When uncertain about a design decision, choose the option that keeps the game **free, offline-capable and fast on iPhone**.

## 17. Reference game analysis: "status - sims but social media" (WishRoll Inc.)

This game is a reference for feel and features only. Build original content, names, UI art and text. Do not copy assets, copy, or trade dress. Sources for this section: the App Store listing and version history, the developer's site, a third-party UX breakdown, and user reviews. The app was not played directly, so the mechanics below are inferred from those sources. Items marked (unverified) come from low-quality sources.

### 17.1 What the game is

An AI-driven social media role-playing game on iPhone (free with in-app purchases, 13+). The player creates a persona, picks a "world" or fandom (celebrities, fictional universes), and lives inside a simulated social feed. Its own tagline is about being anyone, gaining favorite characters as followers, posting with them, becoming famous, or getting cancelled. Rated about 4.6 with roughly 197K ratings on the US App Store. It is strongly character-chat + Twitter-like feed in a single loop, which is very close to this project.

### 17.2 Core loop

1. Choose a persona and a scenario/world (e.g. "accidentally famous").
2. Post, reply, DM, or do an activity.
3. The AI instantly produces a cascade of reactions: comments from characters, follower/like changes, and stat changes.
4. An outcome banner and activity log show what happened and why.
5. Characters remember events, relationships evolve, and the story progresses. Characters may also start conversations or invite the player to activities on their own.

The reward loop that makes it work: every action gets visible, immediate, quantified consequences.

### 17.3 Feature inventory (what they have)

| Area | Observed feature |
|---|---|
| Onboarding | Interactive: shows a mini gameplay loop (choice → outcome) instead of a feature list. Themed, world-building loading messages. |
| Worlds | 100s of presets/fandoms, "create from scratch" flow, public presets with moderation, custom characters library (long character descriptions, up to 1500 characters), bio suggestions when building a scenario. |
| Tone control | A "madness scale" that customizes how realistic vs. absurd the world is. Option to mute news/media outlets in a scenario. |
| Stats | Core stats (e.g. Aura, Humor) that change after major actions, plus skills that can be upgraded. Outcome banner shows score changes. |
| Posting | Post and get AI comments, likes, follower changes. Replies to characters. Viral and "cancelled" outcomes. |
| Stories | Stories feature with a story tray; option to mute public stories. |
| DMs | Chat with characters; relationship score/description changes animate on the chat screen. |
| Relationships | Selectable "chemistry" / relationship vibe types. Characters build history with the player. |
| Activities | Structured scenes with other characters (redesigned several times). Player can schedule future activities. Undo support for moves within an activity. |
| Proactive characters | Characters message first or invite the player into activities when it fits the story. Player controls how often. |
| Events / trends | Event prompts, trending topics, duels and mentions that award XP (unverified detail). |
| Progress | XP/levels, achievements page, streaks and daily rewards, notification center, activity log with past actions, narrative outcomes and the exact score changes they caused. |
| Rewind | A "rewind" system to step the story back. |
| Social | Multiplayer worlds (invite code/link). Referral rewards. |
| Monetization | Energy ("coffee") that posts, replies and DMs consume; ads for extra energy; gems; subscription. Do not copy this. |

### 17.4 What players like and dislike (design lessons)

Liked: cause-and-effect feedback, characters that remember and evolve, freedom to write your own scenarios, feeling like real social media without the toxicity, and stat feedback that makes progress feel earned.

Disliked: the energy/ads/subscription gating (the most common complaint by far), bugs and keyboard glitches, and some reviews mention inconsistent numbers (engagement stats not matching what was visible, e.g. huge like counts on some posts while others seemed frozen). Similar fame sims are criticized for repetitive, predictable replies that ignore what the player actually said.

Lessons for this project:

- No energy, no ads, no gating. AI limits are handled by the free-tier budget limiter (section 8), and are invisible unless AI is exhausted.
- Numbers must be consistent. Likes, comments, reposts and followers must derive from one deterministic formula (fame, follower count, post quality, tags, time). Displayed counts should never contradict the visible comment list or follower count.
- Reactions must reflect what the player did. Use tags, tone and keywords so replies are specific. Track anti-repetition per NPC.

### 17.5 Features to add to this project (mapped to the existing design)

Each item should reuse the GameEvent → ReactionEngine → Scheduler pipeline (section 5). Build them after the milestones in section 14 unless noted.

- **Outcome banner + stat deltas** (high priority, Milestone 2). After every player action, show a compact banner: "+1.2K followers, +3 Hype, −2 Reputation" with a one-line reason. Stats for this game: Fame, Morale, Form, plus social stats Hype, Charisma, Reputation, and a Controversy meter. Deltas come from code, never from the AI.
- **Activity log** (Milestone 2-3). A screen listing every action, the events it produced, the reactions, and the exact stat changes. Store as `ActivityLogEntry { id, at, action, eventId, deltas, summary }`.
- **Rewind / undo** (Milestone 5). Keep the last N (e.g. 5) lightweight snapshots or reversible patches of `SaveGame`, taken before player actions. "Undo" reverts state and removes items scheduled by that action. Inside a scene, allow stepping back one beat. Cap memory use for iPhone.
- **Proactive NPCs** (Milestone 4). NPCs initiate DMs, invite the player to an event (dinner, training, party), or react on their own, driven by relationship, mood and recent events, via the scheduler. Settings: proactivity frequency (off / low / medium / high) and per-NPC mute.
- **Relationship vibes** (Milestone 4). A vibe on each NPC-player relationship: `friend | rival | mentor | teammate_bond | fan | romantic | frenemy`. Vibes gate dialogue branches and comment/DM pools. Keep content non-explicit and age-appropriate.
- **Madness scale** (Milestone 3). A world-level dial from realistic to absurd (e.g. 0-4). Template pools and AI prompts are tagged/parameterized by it, so the same event produces grounded or over-the-top coverage.
- **Scheduled activities** (Milestone 5). The player schedules a future event with one or more NPCs (dinner, training session, party, interview). It becomes a `ScheduledItem` that opens the matching scene when due.
- **Cancel / scandal arc** (Milestone 5). When Controversy passes thresholds, trigger a chain: outrage comments → tabloid piece → sponsor/coach DM → player chooses an apology / double-down / ignore response scene → Reputation and follower effects.
- **Trending topics and hashtags** (Milestone 3). A trending panel generated from recent events and tags. Participating in a trend (posting with the hashtag) gives extra reach and XP.
- **Banter duels** (Milestone 5). A short scene template where a rival challenges the player: 3 rounds of choices/rolls against Charisma; winner gains Hype, loser takes a small Reputation hit. Fans react in comments.
- **XP, levels and achievements** (Milestone 7). Local only. Achievements are data-driven JSON (e.g. "first viral post", "survive a cancel arc", "hat-trick post reaches 10K likes").
- **Notification center** (Milestone 3). Follows, replies, media mentions, DMs, trend and event invitations.
- **World packs and custom characters** (Milestone 7). World = JSON pack (club, NPC roster, media personas, content pools, madness defaults). Provide a form to create a custom NPC (name, persona, personality, bio up to about 1500 characters). The custom description feeds template selection by tags and the AI prompt when AI is on.
- **Interactive onboarding** (Milestone 1-2). After creating the player profile, run a scripted first post that shows the full loop: comments trickling in, a stat banner, a follower change. No feature-list slides.
- **Themed loading states** (polish). Short, in-world loading messages while AI content is generated.
- **Story tray extras** (Milestone 3). Mute per account, viewed/unviewed rings, expiry.
- **Mute media outlets** (Milestone 3). Setting to mute individual journalist/tabloid personas.

### 17.6 Explicitly out of scope

- Energy/coffee, gems, ads, subscriptions, referral rewards, paywalls.
- Multiplayer and shared worlds (no backend).
- Real celebrities or real people as characters. Default roster stays fictional (section 13).
- Explicit/NSFW content of any kind.

### 17.7 Implementation notes for these additions

- All deltas are computed by deterministic functions (pure, unit-tested, seeded RNG). AI output can only adjust wording and small bounded modifiers.
- Engagement formula: `likes ≈ f(followers, fame, quality, tags, timeOfDay, noise)`; comment count shown = actual number of generated comments plus a derived "more replies" estimate clearly separated from the visible list.
- Undo must also clear or reschedule any `ScheduledItem`s and AI-cache entries created by the undone action.
- Performance: the activity log, notification center and trending panel must be virtualized and lazy-loaded like other screens (section 9).
- Update `SaveGame` (section 6) with: `activityLog`, `undoStack`, `stats` (Hype, Charisma, Reputation, Controversy), `worldSettings.madness`, `worldSettings.proactivity`, `relationships[].vibe`, `achievements`, `xp`, `mutedAccounts`. Bump version and add a migration.
