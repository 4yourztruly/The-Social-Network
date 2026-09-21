import type { Effect, PlayerState } from '../types'

type ClampedStat = 'humor' | 'aura'

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

// Applies Effect[] to the player's own stats. 'followers' targets the
// player's Profile (not PlayerState) and 'mood'/'relationship' target an
// NPC — both are handled by the caller, not here.
export function applyPlayerEffects(player: PlayerState, effects: readonly Effect[]): PlayerState {
  const next = { ...player }
  for (const effect of effects) {
    if (effect.type === 'stat') {
      const key = effect.target as ClampedStat | undefined
      if (key === 'humor' || key === 'aura') {
        next[key] = clamp(next[key] + effect.delta)
      }
    }
  }
  return next
}

// Picks out the humor/aura deltas from an Effect[] and turns them into the
// caption shown under each stat bar on the player's own profile (same idea
// as NPC.lastRelationshipChange) — `reason` is whatever the caller already
// has on hand that explains the change (the post text, the activity
// description, the event's narrated outcome).
export function lastStatChangesFromEffects(
  effects: readonly Effect[],
  reason: string,
  at: number,
): Pick<PlayerState, 'lastHumorChange' | 'lastAuraChange'> {
  const changes: Pick<PlayerState, 'lastHumorChange' | 'lastAuraChange'> = {}
  for (const effect of effects) {
    if (effect.type !== 'stat' || effect.delta === 0) continue
    if (effect.target === 'humor') changes.lastHumorChange = { delta: effect.delta, reason, at }
    if (effect.target === 'aura') changes.lastAuraChange = { delta: effect.delta, reason, at }
  }
  return changes
}
