import type { Activity, DMThread, NPC, Post, Profile, WorldStory } from '../types'

// One place that decides what a given NPC knows and remembers, so the same
// person shows up with the same knowledge everywhere — in their DMs, in the
// activities and events they're part of, in their comments and replies, in
// the news. Every AI prompt asks for `npcDossier(npc)` instead of building
// its own idea of the character.
//
// The store registers where to read the live game from (see
// registerMemorySource) — that keeps every prompt builder's signature
// unchanged, and an unregistered source (tests) just yields the facts alone.

export interface MemoryState {
  playerName: string
  activities: Record<string, Activity>
  threads: Record<string, DMThread>
  posts: Record<string, Post>
  profiles: Record<string, Profile | NPC>
  worldStories: WorldStory[]
}

let source: (() => MemoryState) | null = null

export function registerMemorySource(fn: () => MemoryState): void {
  source = fn
}

const MAX_ACTIVITIES = 6
const MAX_DETAILED_ACTIVITIES = 2
const MAX_DMS = 4
const MAX_PUBLIC = 3
const MAX_NEWS = 3

export function buildDossier(npc: NPC, state: MemoryState | null): string {
  const lines: string[] = []
  if (npc.knowledge) lines.push(`What is publicly known about the real person (looked up — trust this over your own guesses): ${npc.knowledge}`)
  if (!state) return lines.join('\n')

  const player = state.playerName
  // Everything you two have actually done together — the count, and what
  // really happened in the most recent ones (the scene's own beats, not a
  // canned "it went well"). People who were invited but declined weren't there.
  const together = Object.values(state.activities)
    .filter((a) => a.participantIds.includes(npc.id) && a.rsvps?.[npc.id] !== 'declined' && (a.status === 'ended' || a.status === 'active'))
    .sort((a, b) => b.createdAt - a.createdAt)
  if (together.length > 0) {
    lines.push(`- You and ${player} have spent time together ${together.length} ${together.length === 1 ? 'time' : 'times'}: ${together
      .slice(0, MAX_ACTIVITIES)
      .map((a) => `"${a.description}"`)
      .join(', ')}${together.length > MAX_ACTIVITIES ? ', and more' : ''}. You remember all of it.`)
  }
  together.slice(0, MAX_DETAILED_ACTIVITIES).forEach((a, i) => {
    const beats = a.messages
      .slice(-4)
      .map((m) => `${m.from === 'player' ? player : 'Narrator'}: ${m.text}`)
      .join(' / ')
      .slice(0, 420)
    const when = i === 0 ? 'most recent' : 'earlier'
    lines.push(
      a.status === 'active'
        ? `- You are with ${player} right now ("${a.description}"). What just happened: ${beats}`
        : `- In the ${when} one ("${a.description}"): ${beats}. Outcome: ${a.outcomeSummary ?? 'it wrapped up'}.`,
    )
  })

  const thread = state.threads[npc.id]
  if (thread && thread.messages.length > 0) {
    const recent = thread.messages
      .slice(-MAX_DMS)
      .map((m) => `${m.from === 'player' ? player : 'You'}: ${m.text}`)
      .join(' / ')
    lines.push(`- Your recent DMs with ${player}: ${recent}`)
  }

  // Public back-and-forth: the player's replies to this NPC's posts/comments
  // and this NPC's replies to the player's.
  const publicExchanges: string[] = []
  for (const p of Object.values(state.posts)) {
    if (p.kind !== 'reply' || !p.parentId) continue
    const parent = state.posts[p.parentId]
    if (!parent) continue
    if (p.authorId === npc.id && parent.authorId === 'player') publicExchanges.push(`${player} said "${parent.text}" and you replied "${p.text}"`)
    else if (p.authorId === 'player' && parent.authorId === npc.id) publicExchanges.push(`you said "${parent.text}" and ${player} replied "${p.text}"`)
  }
  for (const line of publicExchanges.slice(-MAX_PUBLIC)) lines.push(`- Publicly: ${line}`)

  if (npc.lastRelationshipChange?.reason) lines.push(`- Lately between you two: ${npc.lastRelationshipChange.reason}`)

  const news = state.worldStories.filter((s) => s.people.includes(npc.id)).slice(-MAX_NEWS)
  for (const s of news) lines.push(`- In the news about you: ${s.text}`)

  if (lines.length === 0) return ''
  return lines.join('\n')
}

// The whole block, ready to drop into a prompt, or '' when there's nothing.
export function npcDossier(npc: NPC, compact = false): string {
  const body = buildDossier(npc, source ? source() : null)
  if (!body) return ''
  // Short form for batch prompts that carry many characters at once.
  if (compact) {
    return body
      .split('\n')
      .slice(0, 4)
      .map((l) => l.replace(/^- /, '').replace(/^What is publicly known about the real person \(.*?\): /, 'real-life facts: ').slice(0, 260))
      .join(' | ')
  }
  return [
    `What ${npc.displayName} knows and remembers (these are real memories in this world — you are the same person everywhere, in DMs, activities, posts and comments. Act consistently with them and never as if they are news to you, or come out of nowhere. If the player mentions something in your shared history, answer as someone who was there — never ask what they mean or act like you don't know):`,
    body,
  ].join('\n')
}
