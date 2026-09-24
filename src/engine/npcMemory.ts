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

const MAX_ACTIVITIES = 3
const MAX_DMS = 4
const MAX_PUBLIC = 3
const MAX_NEWS = 3

export function buildDossier(npc: NPC, state: MemoryState | null): string {
  const lines: string[] = []
  if (npc.knowledge) lines.push(`What is publicly known about the real person (looked up — trust this over your own guesses): ${npc.knowledge}`)
  if (!state) return lines.join('\n')

  const player = state.playerName
  const activities = Object.values(state.activities)
    .filter((a) => a.participantIds.includes(npc.id) && (a.status === 'ended' || a.status === 'active'))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_ACTIVITIES)
  for (const a of activities) {
    if (a.status === 'ended') {
      lines.push(`- You and ${player} did this together: "${a.description}". How it went: ${a.outcomeSummary ?? 'it wrapped up'}.`)
    } else {
      const last = a.messages.at(-1)
      lines.push(`- You are with ${player} right now: "${a.description}".${last ? ` Latest: ${last.text}` : ''}`)
    }
  }

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
    `What ${npc.displayName} knows and remembers (these are real memories in this world — you are the same person everywhere, in DMs, activities, posts and comments. Act consistently with them and never as if they are news to you, or come out of nowhere):`,
    body,
  ].join('\n')
}
