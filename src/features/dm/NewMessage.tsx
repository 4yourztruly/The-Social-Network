import { useMemo } from 'react'
import { useGameStore } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { ArrowLeftIcon } from '../../components/icons'

interface NewMessageProps {
  onSelect: (npcId: string) => void
  onBack: () => void
}

export function NewMessage({ onSelect, onBack }: NewMessageProps) {
  const profiles = useGameStore((s) => s.profiles)

  const npcs = useMemo(() => Object.values(profiles).filter(isNPC), [profiles])
  const following = useMemo(
    () => npcs.filter((n) => n.followedByPlayer).sort((a, b) => b.followers - a.followers),
    [npcs],
  )
  const others = useMemo(
    () => npcs.filter((n) => !n.followedByPlayer).sort((a, b) => b.followers - a.followers),
    [npcs],
  )

  const Row = ({ npc }: { npc: (typeof npcs)[number] }) => (
    <button
      onClick={() => onSelect(npc.id)}
      className="flex w-full items-center gap-3 border-b border-neutral-200 px-4 py-3 text-left dark:border-neutral-800"
    >
      <Avatar avatar={npc.avatar} seed={npc.id} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate font-semibold">{npc.displayName}</span>
          {npc.verified && <VerifiedBadge />}
        </div>
        <p className="truncate text-sm text-neutral-500">@{npc.username}</p>
      </div>
    </button>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">New message</h1>
      </div>

      {following.length > 0 && (
        <>
          <p className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
            Following
          </p>
          {following.map((npc) => (
            <Row key={npc.id} npc={npc} />
          ))}
        </>
      )}

      {others.length > 0 && (
        <>
          <p className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
            Everyone else
          </p>
          {others.map((npc) => (
            <Row key={npc.id} npc={npc} />
          ))}
        </>
      )}
    </div>
  )
}
