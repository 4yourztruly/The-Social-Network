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

// Filters out lines the NPC has used recently (anti-repetition), falling
// back to the full candidate set if everything's been said recently.
export function selectLine(
  rng: RNG,
  pool: ReactionPool,
  tags: string[],
  recentLineIds: readonly string[],
): LineSelection {
  const candidates = candidateLines(pool, tags)
  const withIds = candidates.map((line) => ({ line, lineId: lineIdFor(line) }))
  const fresh = withIds.filter((c) => !recentLineIds.includes(c.lineId))
  return pick(rng, fresh.length > 0 ? fresh : withIds)
}

export function pushRecentLine(recentLineIds: readonly string[], lineId: string): string[] {
  return [...recentLineIds, lineId].slice(-RECENT_LINES_CAP)
}
