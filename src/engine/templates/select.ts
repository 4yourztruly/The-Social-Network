import { hashStringToSeed, pick, type RNG } from '../rng'

export interface ReactionPool {
  generic: string[]
  byTag: Record<string, string[]>
}

const RECENT_LINES_CAP = 8

export function candidateLines(pool: ReactionPool, tags: string[]): string[] {
  for (const tag of tags) {
    const lines = pool.byTag[tag]
    if (lines && lines.length > 0) return lines
  }
  return pool.generic
}

export function lineIdFor(line: string): string {
  return hashStringToSeed(line).toString(36)
}

export interface LineSelection {
  line: string
  lineId: string
}

// Shared by selectLine (tag-aware ReactionPool) and selectPlainLine (a flat
// string[], e.g. seedPostPool) — filters out lines used recently
// (anti-repetition), falling back to the full candidate set if everything's
// been said recently rather than ever returning nothing.
function pickFresh(rng: RNG, candidates: string[], recentLineIds: readonly string[]): LineSelection {
  const withIds = candidates.map((line) => ({ line, lineId: lineIdFor(line) }))
  const fresh = withIds.filter((c) => !recentLineIds.includes(c.lineId))
  return pick(rng, fresh.length > 0 ? fresh : withIds)
}

export function selectLine(
  rng: RNG,
  pool: ReactionPool,
  tags: string[],
  recentLineIds: readonly string[],
): LineSelection {
  return pickFresh(rng, candidateLines(pool, tags), recentLineIds)
}

// Same anti-repetition behavior as selectLine, for a plain line pool with no
// tag/mood branching (e.g. CareerPack.seedPostPool, content/genericFiller.ts).
export function selectPlainLine(rng: RNG, lines: string[], recentLineIds: readonly string[]): LineSelection {
  return pickFresh(rng, lines, recentLineIds)
}

export function pushRecentLine(recentLineIds: readonly string[], lineId: string): string[] {
  return [...recentLineIds, lineId].slice(-RECENT_LINES_CAP)
}
