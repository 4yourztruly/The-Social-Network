import { useMemo, useState } from 'react'
import { useGameStore, PLAYER_ID } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { ArrowLeftIcon } from '../../components/icons'
import { formatRelativeTime } from '../../engine/time'
import { ACTIVITY_TURN_CAP } from '../../engine/activity'

interface ActivityChatProps {
  activityId: string
  onBack: () => void
  onOpenProfile: (profileId: string) => void
}

export function ActivityChat({ activityId, onBack, onOpenProfile }: ActivityChatProps) {
  const activity = useGameStore((s) => s.activities[activityId])
  const profiles = useGameStore((s) => s.profiles)
  const player = useGameStore((s) => s.profiles[PLAYER_ID])
  const aiTyping = useGameStore((s) => s.aiTyping)
  const sendActivityChoice = useGameStore((s) => s.sendActivityChoice)
  const endActivity = useGameStore((s) => s.endActivity)
  const startActivity = useGameStore((s) => s.startActivity)
  const deleteActivity = useGameStore((s) => s.deleteActivity)
  const [text, setText] = useState('')

  const [rsvpAcknowledged, setRsvpAcknowledged] = useState(false)

  const participants = useMemo(
    () => (activity?.participantIds ?? []).map((id) => profiles[id]).filter(isNPC),
    [activity?.participantIds, profiles],
  )

  const isTyping = aiTyping.includes(activityId)

  if (!activity || !player) return null

  const handleSend = (value: string) => {
    if (!value.trim() || activity.status !== 'active') return
    sendActivityChoice(activityId, value)
    setText('')
  }

  const handleDelete = () => {
    deleteActivity(activityId)
    onBack()
  }

  // Right after Start, who actually showed up — see engine/activity.ts
  // computeRsvp and store.startActivity. Only shown once per visit to this
  // screen; "Continue" moves into the scene itself.
  if (activity.status === 'active' && activity.rsvps && !rsvpAcknowledged) {
    const accepted = participants.filter((p) => activity.rsvps?.[p.id] === 'accepted')
    const declined = participants.filter((p) => activity.rsvps?.[p.id] === 'declined')
    return (
      <div className="flex h-full flex-col">
        <div className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
          <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <p className="truncate text-[15px] font-semibold">{activity.description}</p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Who showed up</p>

          {participants.length === 0 && <p className="text-sm text-neutral-500">Flying solo this time.</p>}

          {accepted.length > 0 && (
            <div className="w-full max-w-xs">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Accepted
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {accepted.map((npc) => (
                  <div key={npc.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2 dark:border-neutral-800">
                    <Avatar avatar={npc.avatar} seed={npc.id} size={32} />
                    <span className="text-sm font-medium">{npc.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {declined.length > 0 && (
            <div className="w-full max-w-xs">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Couldn't make it</p>
              <div className="mt-2 flex flex-col gap-2">
                {declined.map((npc) => (
                  <div
                    key={npc.id}
                    className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2 opacity-60 dark:border-neutral-800"
                  >
                    <Avatar avatar={npc.avatar} seed={npc.id} size={32} />
                    <span className="text-sm font-medium">{npc.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setRsvpAcknowledged(true)}
            className="mt-2 cursor-pointer rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
        <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{activity.description}</p>
          {participants.length > 0 && (
            <div className="mt-1 flex items-center gap-1">
              {participants.map((npc) => (
                <button
                  key={npc.id}
                  onClick={() => onOpenProfile(npc.id)}
                  className="flex cursor-pointer items-center gap-1 rounded-full bg-neutral-100 py-0.5 pl-0.5 pr-2 text-xs dark:bg-neutral-800"
                >
                  <Avatar avatar={npc.avatar} seed={npc.id} size={18} />
                  {npc.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
        {activity.status === 'active' && (
          <button
            onClick={() => endActivity(activityId)}
            className="shrink-0 cursor-pointer rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            End activity
          </button>
        )}
        {activity.status === 'ended' && (
          <button
            onClick={handleDelete}
            className="shrink-0 cursor-pointer rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            Delete
          </button>
        )}
      </div>

      {activity.status === 'scheduled' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-sm text-neutral-500">
            Not started yet{activity.plannedLabel ? ` · planned: ${activity.plannedLabel}` : ''}. Start it whenever
            you're ready.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => startActivity(activityId)}
              className="cursor-pointer rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
            >
              Start activity
            </button>
            <button
              onClick={handleDelete}
              className="cursor-pointer rounded-full border border-rose-300 px-5 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              Delete activity
            </button>
          </div>
        </div>
      )}

      {activity.status !== 'scheduled' && (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          {activity.messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'player' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[15px] ${
                  m.from === 'player'
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-100 italic text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {m.text}
                <span
                  className={`ml-2 not-italic text-[10px] ${m.from === 'player' ? 'text-blue-100/80' : 'text-neutral-500'}`}
                >
                  {formatRelativeTime(m.at)}
                </span>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl bg-neutral-100 px-3 py-2 dark:bg-neutral-800">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
              </div>
            </div>
          )}
          {activity.status === 'ended' && (
            <div className="mt-4 rounded-xl border border-neutral-200 p-3 text-center text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              {activity.outcomeSummary ?? 'Activity complete.'}
            </div>
          )}
        </div>
      </div>
      )}

      {activity.status === 'active' && (
        <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800">
          <p className="px-4 pt-2 text-xs text-neutral-500">
            {Math.max(0, ACTIVITY_TURN_CAP - activity.turnCount)} turn
            {Math.max(0, ACTIVITY_TURN_CAP - activity.turnCount) === 1 ? '' : 's'} left
          </p>
          {!isTyping && activity.pendingChoices.length > 0 && (
            <div className="flex flex-col gap-2 px-4 pt-3">
              {activity.pendingChoices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(choice)}
                  className="cursor-pointer rounded-xl border border-neutral-200 px-4 py-3 text-left text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {choice}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-2">
            <Avatar avatar={player.avatar} seed={player.id} size={32} />
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(text)}
              placeholder="Or write your own move..."
              className="min-w-0 flex-1 bg-transparent text-[15px] placeholder-neutral-500 outline-none"
            />
            <button
              onClick={() => handleSend(text)}
              disabled={!text.trim()}
              className="shrink-0 cursor-pointer rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
