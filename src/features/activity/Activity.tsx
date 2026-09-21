import { useMemo, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { PlusIcon, SparkleIcon } from '../../components/icons'
import { CreateActivity } from './CreateActivity'
import { ActivityChat } from './ActivityChat'

interface ActivityProps {
  onOpenProfile: (profileId: string) => void
}

export function ActivityScreen({ onOpenProfile }: ActivityProps) {
  const activities = useGameStore((s) => s.activities)
  const profiles = useGameStore((s) => s.profiles)
  const [creating, setCreating] = useState(false)
  const [openActivityId, setOpenActivityId] = useState<string | null>(null)

  const rows = useMemo(
    () => Object.values(activities).sort((a, b) => b.createdAt - a.createdAt),
    [activities],
  )

  if (openActivityId) {
    return (
      <ActivityChat activityId={openActivityId} onBack={() => setOpenActivityId(null)} onOpenProfile={onOpenProfile} />
    )
  }

  if (creating) {
    return (
      <CreateActivity
        onBack={() => setCreating(false)}
        onCreated={() => setCreating(false)}
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <h1 className="text-lg font-bold">Activity</h1>
        <button
          onClick={() => setCreating(true)}
          aria-label="New activity"
          className="cursor-pointer rounded-full bg-neutral-900 p-1.5 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {rows.length > 0 ? (
        rows.map((activity) => {
          const participants = activity.participantIds.map((id) => profiles[id]).filter(isNPC)
          return (
            <button
              key={activity.id}
              onClick={() => setOpenActivityId(activity.id)}
              className="flex w-full cursor-pointer items-start gap-3 border-b border-neutral-200 px-4 py-3 text-left hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
            >
              <div className="flex shrink-0 -space-x-2">
                {participants.length > 0 ? (
                  participants.slice(0, 3).map((npc) => <Avatar key={npc.id} avatar={npc.avatar} seed={npc.id} size={36} />)
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <SparkleIcon className="h-4 w-4 text-neutral-400" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{activity.description}</p>
                <p className="text-xs text-neutral-500">
                  {activity.status === 'scheduled' && `Not started yet${activity.plannedLabel ? ` · planned: ${activity.plannedLabel}` : ''}`}
                  {activity.status === 'active' && 'In progress'}
                  {activity.status === 'ended' && (activity.outcomeSummary ?? 'Ended')}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  activity.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : activity.status === 'scheduled'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'
                }`}
              >
                {activity.status}
              </span>
            </button>
          )
        })
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex w-full cursor-pointer flex-col items-center gap-2 px-8 py-20 text-center hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
        >
          <SparkleIcon className="h-10 w-10 text-neutral-400" />
          <p className="text-sm text-neutral-500">
            Describe a scene — a date, a night out, training — and play through it. Tap{' '}
            <PlusIcon className="inline h-3 w-3 align-middle" /> to start one.
          </p>
        </button>
      )}
    </div>
  )
}
