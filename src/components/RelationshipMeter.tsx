import type { RelationshipVibe } from '../types'
import { relationshipDescriptor } from '../ai/shared'

interface RelationshipMeterProps {
  relationship: number // -100..100
  vibe: RelationshipVibe
}

const VIBE_LABELS: Record<RelationshipVibe, string> = {
  friend: 'Friend',
  rival: 'Rival',
  mentor: 'Mentor',
  teammate_bond: 'Teammate',
  fan: 'Fan',
  romantic: 'Romantic',
  frenemy: 'Frenemy',
}

// A -100..100 relationship bar with a vibe label — "Rival · cold, some
// tension" or "Romantic · very close — a real bond". Shown on any NPC's
// profile, not gated to player-added people, since the underlying data
// (relationship + vibe) already exists for the whole roster.
export function RelationshipMeter({ relationship, vibe }: RelationshipMeterProps) {
  const clamped = Math.max(-100, Math.min(100, relationship))
  const half = (Math.abs(clamped) / 100) * 50 // % of the bar's half-width
  const color = clamped >= 20 ? 'bg-emerald-500' : clamped >= -20 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-neutral-700 dark:text-neutral-300">{VIBE_LABELS[vibe]}</span>
        <span className="text-neutral-500">{relationshipDescriptor(clamped)}</span>
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-400 dark:bg-neutral-600" />
        <div
          className={`absolute inset-y-0 ${color} transition-[width]`}
          style={clamped >= 0 ? { left: '50%', width: `${half}%` } : { right: '50%', width: `${half}%` }}
        />
      </div>
    </div>
  )
}
