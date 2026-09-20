import { useMemo, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { formatRelativeTime } from '../../engine/time'
import { MailIcon, PlusIcon } from '../../components/icons'
import { NewMessage } from './NewMessage'

interface DMsProps {
  onOpenThread: (npcId: string) => void
}

export function DMs({ onOpenThread }: DMsProps) {
  const threads = useGameStore((s) => s.threads)
  const profiles = useGameStore((s) => s.profiles)
  const [showNewMessage, setShowNewMessage] = useState(false)

  const rows = useMemo(
    () =>
      Object.values(threads)
        .filter((t) => t.messages.length > 0)
        .sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0)),
    [threads],
  )

  if (showNewMessage) {
    return (
      <NewMessage
        onBack={() => setShowNewMessage(false)}
        onSelect={(npcId) => {
          setShowNewMessage(false)
          onOpenThread(npcId)
        }}
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <h1 className="text-lg font-bold">Messages</h1>
        <button
          onClick={() => setShowNewMessage(true)}
          aria-label="New message"
          className="rounded-full bg-neutral-900 p-1.5 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {rows.length > 0 ? (
        rows.map((thread) => {
          const npc = profiles[thread.npcId]
          if (!npc || !isNPC(npc)) return null
          const last = thread.messages.at(-1)!
          return (
            <button
              key={thread.id}
              onClick={() => onOpenThread(thread.npcId)}
              className="flex w-full cursor-pointer items-center gap-3 border-b border-neutral-200 px-4 py-3 text-left hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
            >
              <Avatar avatar={npc.avatar} seed={npc.id} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate font-semibold">{npc.displayName}</span>
                  {npc.verified && <VerifiedBadge />}
                  <span className="ml-auto shrink-0 text-xs text-neutral-500">{formatRelativeTime(last.at)}</span>
                </div>
                <p
                  className={`truncate text-sm ${
                    thread.unread > 0 ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-500'
                  }`}
                >
                  {last.from === 'player' ? 'You: ' : ''}
                  {last.text}
                </p>
              </div>
              {thread.unread > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 px-1.5 text-xs font-semibold text-white">
                  {thread.unread}
                </span>
              )}
            </button>
          )
        })
      ) : (
        <button
          onClick={() => setShowNewMessage(true)}
          className="flex w-full cursor-pointer flex-col items-center gap-2 px-8 py-20 text-center hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
        >
          <MailIcon className="h-10 w-10 text-neutral-400" />
          <p className="text-sm text-neutral-500">
            No messages yet. Tap <PlusIcon className="inline h-3 w-3 align-middle" /> to start one.
          </p>
        </button>
      )}
    </div>
  )
}
