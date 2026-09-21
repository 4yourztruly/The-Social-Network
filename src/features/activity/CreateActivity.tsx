import { useMemo, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { ArrowLeftIcon } from '../../components/icons'

interface CreateActivityProps {
  onBack: () => void
  onCreated: (activityId: string) => void
}

// Purely a label on the created activity now — activities never auto-start,
// the player always taps Start explicitly once it's created.
const WHEN_OPTIONS = ['Now', 'In an hour', 'Tonight', 'Tomorrow']

export function CreateActivity({ onBack, onCreated }: CreateActivityProps) {
  const profiles = useGameStore((s) => s.profiles)
  const createActivity = useGameStore((s) => s.createActivity)

  const followedNpcs = useMemo(
    () =>
      Object.values(profiles)
        .filter(isNPC)
        .filter((n) => n.followedByPlayer)
        .sort((a, b) => b.relationship - a.relationship),
    [profiles],
  )

  const [description, setDescription] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [plannedLabel, setPlannedLabel] = useState(WHEN_OPTIONS[0])
  const [error, setError] = useState<string | null>(null)

  const toggleParticipant = (id: string) => {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const handleCreate = () => {
    if (!description.trim()) {
      setError('Describe what happens first.')
      return
    }
    const id = createActivity({ description, participantIds, plannedLabel })
    onCreated(id)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">New activity</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-600 dark:text-neutral-400">What happens</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 280))}
            placeholder="e.g. Dinner date at a rooftop restaurant"
            rows={3}
            className="resize-none rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-neutral-500 dark:border-neutral-700"
          />
        </label>

        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">When (just a label — you start it yourself)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WHEN_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setPlannedLabel(opt)}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  plannedLabel === opt
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'border border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Who's there {participantIds.length > 0 && `(${participantIds.length})`}
          </p>
          {followedNpcs.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">
              You're not following anyone yet — this activity will be solo. Follow people from their
              profile or People screen to invite them.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {followedNpcs.map((npc) => {
                const selected = participantIds.includes(npc.id)
                return (
                  <button
                    key={npc.id}
                    onClick={() => toggleParticipant(npc.id)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60'
                    }`}
                  >
                    <Avatar avatar={npc.avatar} seed={npc.id} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{npc.displayName}</span>
                    {selected && <span className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">Invited</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <button
          onClick={handleCreate}
          className="mt-5 w-full cursor-pointer rounded-full bg-neutral-900 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
        >
          Create
        </button>
      </div>
    </div>
  )
}
