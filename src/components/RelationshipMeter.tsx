import type { RelationshipVibe } from '../types'
import { relationshipDescriptor } from '../ai/shared'
import { CenteredBar } from './CenteredBar'

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

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800 dark:bg-neutral-800">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-neutral-700 dark:text-neutral-300">{VIBE_LABELS[vibe]}</span>
        <span className="text-neutral-500">{relationshipDescriptor(clamped)}</span>
      </div>
      <CenteredBar value={clamped} className="mt-2" />
    </div>
  )
}
