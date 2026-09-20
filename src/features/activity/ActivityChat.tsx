import { useMemo, useState } from 'react'
import { useGameStore, PLAYER_ID } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { ArrowLeftIcon } from '../../components/icons'
import { formatRelativeTime } from '../../engine/time'
import { ACTIVITY_CHOICES } from '../../engine/activity'

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
  const [text, setText] = useState('')

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

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {activity.status === 'scheduled' && (
          <p className="py-8 text-center text-sm text-neutral-500">
            Scheduled for {new Date(activity.startAt).toLocaleString()}. It'll start automatically.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {activity.messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'player' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[15px] ${
                  m.from === 'player'
                    ? 'bg-fuchsia-600 text-white'
                    : 'bg-neutral-100 italic text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {m.text}
                <span
                  className={`ml-2 not-italic text-[10px] ${m.from === 'player' ? 'text-fuchsia-100/80' : 'text-neutral-500'}`}
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

      {activity.status === 'active' && (
        <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex gap-2 overflow-x-auto px-4 pt-2">
            {ACTIVITY_CHOICES.map((choice) => (
              <button
                key={choice}
                onClick={() => handleSend(choice)}
                className="shrink-0 cursor-pointer rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                {choice}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 py-2">
            <Avatar avatar={player.avatar} seed={player.id} size={32} />
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(text)}
              placeholder="Or say/do something else..."
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
