import { useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { isNPC } from '../types'
import { Avatar } from './Avatar'
import { VerifiedBadge } from './VerifiedBadge'
import { ChevronRightIcon } from './icons'

interface RelationshipListProps {
  onOpenProfile: (profileId: string) => void
}

// Every person the player follows, as a relationship card: avatar, name,
// a 0-100% bar, and a caption naming the most recent thing that moved it —
// shown on the player's own profile, under the Humor/Aura stats.
export function RelationshipList({ onOpenProfile }: RelationshipListProps) {
  const profiles = useGameStore((s) => s.profiles)

  const npcs = useMemo(
    () =>
      Object.values(profiles)
        .filter(isNPC)
        .filter((n) => n.followedByPlayer)
        .sort((a, b) => b.relationship - a.relationship),
    [profiles],
  )

  if (npcs.length === 0) return null

  return (
    <div className="mt-4">
      <h2 className="text-sm font-semibold text-neutral-500">Relationships ({npcs.length})</h2>
      <div className="mt-2 flex flex-col gap-2">
        {npcs.map((npc) => {
          const clamped = Math.max(-100, Math.min(100, npc.relationship))
          const pct = Math.round(((clamped + 100) / 200) * 100)
          const change = npc.lastRelationshipChange

          return (
            <button
              key={npc.id}
              onClick={() => onOpenProfile(npc.id)}
              className="cursor-pointer rounded-2xl border border-neutral-200 p-3 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
            >
              <div className="flex items-center gap-3">
                <Avatar avatar={npc.avatar} seed={npc.id} size={36} />
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <span className="truncate text-sm font-semibold">{npc.displayName}</span>
                  {npc.verified && <VerifiedBadge />}
                </div>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-neutral-400" />
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
                </div>
                <span className="shrink-0 text-xs font-semibold text-neutral-600 dark:text-neutral-400">{pct}%</span>
              </div>

              {change && (
                <p className="mt-1.5 truncate text-xs text-neutral-500">
                  <span
                    className={`font-semibold ${change.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                  >
                    {change.delta >= 0 ? '+' : ''}
                    {change.delta}
                  </span>{' '}
                  {change.reason}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
