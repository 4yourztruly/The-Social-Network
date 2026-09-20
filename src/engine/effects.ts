import type { Effect, PlayerState } from '../types'

type ClampedStat = 'hype' | 'charisma' | 'reputation' | 'controversy' | 'humor' | 'aura'

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

// Applies Effect[] to the player's own stats. 'followers' targets the
// player's Profile (not PlayerState) and 'mood'/'relationship' target an
// NPC — both are handled by the caller, not here.
export function applyPlayerEffects(player: PlayerState, effects: readonly Effect[]): PlayerState {
  const next = { ...player }
  for (const effect of effects) {
    switch (effect.type) {
      case 'fame':
        next.fame = clamp(next.fame + effect.delta)
        break
      case 'morale':
        next.morale = clamp(next.morale + effect.delta)
        break
      case 'form':
        next.form = clamp(next.form + effect.delta)
        break
      case 'stat': {
        const key = effect.target as ClampedStat | undefined
        if (
          key === 'hype' ||
          key === 'charisma' ||
          key === 'reputation' ||
          key === 'controversy' ||
          key === 'humor' ||
          key === 'aura'
        ) {
          next[key] = clamp(next[key] + effect.delta)
        }
        break
      }
      default:
        break
    }
  }
  return next
}
