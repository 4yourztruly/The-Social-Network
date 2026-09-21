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
