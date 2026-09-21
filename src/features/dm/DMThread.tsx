import { useEffect, useMemo, useState } from 'react'
import { useGameStore, PLAYER_ID } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { ArrowLeftIcon } from '../../components/icons'
import { formatRelativeTime } from '../../engine/time'
import { shortNameFor } from '../../components/shortName'

interface DMThreadProps {
  npcId: string
  onOpenProfile: (profileId: string) => void
  onBack: () => void
}

export function DMThread({ npcId, onOpenProfile, onBack }: DMThreadProps) {
  const npc = useGameStore((s) => s.profiles[npcId])
  const player = useGameStore((s) => s.profiles[PLAYER_ID])
  const thread = useGameStore((s) => s.threads[npcId])
  const scheduled = useGameStore((s) => s.scheduled)
  const aiTyping = useGameStore((s) => s.aiTyping)
  const sendPlayerMessage = useGameStore((s) => s.sendPlayerMessage)
  const markThreadRead = useGameStore((s) => s.markThreadRead)
  const [text, setText] = useState('')

  const messages = thread?.messages ?? []

  useEffect(() => {
    markThreadRead(npcId)
  }, [npcId, messages.length, markThreadRead])

  // A pending reply from this NPC is either a scheduled 'dm' item (the
  // deterministic template path) or an in-flight AI call (spec 4.6).
  const isTyping = useMemo(
    () =>
      aiTyping.includes(npcId) ||
      scheduled.some(
        (item) =>
          item.kind === 'dm' &&
          (item.payload as { npcId?: string } | undefined)?.npcId === npcId,
      ),
    [scheduled, aiTyping, npcId],
  )

  const handleSend = () => {
    if (!text.trim()) return
    sendPlayerMessage(npcId, text)
    setText('')
  }

  if (!npc || !isNPC(npc) || !player) return null

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <button onClick={() => onOpenProfile(npc.id)} className="flex min-w-0 items-center gap-2">
          <Avatar avatar={npc.avatar} seed={npc.id} size={32} />
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate font-semibold">{npc.displayName}</span>
            {npc.verified && <VerifiedBadge />}
          </span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !isTyping && (
          <p className="py-8 text-center text-sm text-neutral-500">
            Say hi to {shortNameFor(npc.displayName)}.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'player' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-[15px] ${
                  m.from === 'player'
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                }`}
              >
                {m.text}
                <span
                  className={`ml-2 text-[10px] ${m.from === 'player' ? 'text-blue-100/80' : 'text-neutral-500'}`}
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
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <Avatar avatar={player.avatar} seed={player.id} size={32} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={`Message ${shortNameFor(npc.displayName)}`}
          className="min-w-0 flex-1 bg-transparent text-[15px] placeholder-neutral-500 outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="shrink-0 rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          Send
        </button>
      </div>
    </div>
  )
}
