import { useMemo } from 'react'
import { useGameStore } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { isDmAvailable, isFollowable, isViewableProfile } from '../../engine/npcTier'
import { ArrowLeftIcon, MailIcon } from '../../components/icons'

interface PeopleProps {
  onOpenProfile: (profileId: string) => void
  onOpenDM: (npcId: string) => void
  onBack?: () => void
}

export function People({ onOpenProfile, onOpenDM, onBack }: PeopleProps) {
  const profiles = useGameStore((s) => s.profiles)
  const followNpc = useGameStore((s) => s.followNpc)
  const unfollowNpc = useGameStore((s) => s.unfollowNpc)

  // Commenter-tier NPCs (the general public) have no viewable profile and
  // can't be followed — nothing to do with them here, so they're excluded
  // entirely rather than listed as a dead end. Only celebs (followable,
  // DMable once they follow back) and media accounts (viewable, for their
  // news) show up.
  const npcs = useMemo(
    () =>
      Object.values(profiles)
        .filter(isNPC)
        .filter(isViewableProfile)
        .sort((a, b) => b.followers - a.followers),
    [profiles],
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
        {onBack && (
          <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-bold">People</h1>
      </div>
      {npcs.map((npc) => (
        <div
          key={npc.id}
          className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
        >
          <button onClick={() => onOpenProfile(npc.id)} className="shrink-0 cursor-pointer">
            <Avatar avatar={npc.avatar} seed={npc.id} />
          </button>
          <button onClick={() => onOpenProfile(npc.id)} className="min-w-0 flex-1 cursor-pointer text-left">
            <div className="flex items-center gap-1">
              <span className="truncate font-semibold">{npc.displayName}</span>
              {npc.verified && <VerifiedBadge />}
            </div>
            <p className="truncate text-sm text-neutral-500">@{npc.username}</p>
            <p className="truncate text-xs text-neutral-500 capitalize">{npc.persona.replace('_', ' ')}</p>
          </button>
          {isDmAvailable(npc) && (
            <button
              onClick={() => onOpenDM(npc.id)}
              aria-label={`Message ${npc.displayName}`}
              className="shrink-0 cursor-pointer rounded-full border border-neutral-300 p-2 text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <MailIcon className="h-4 w-4" />
            </button>
          )}
          {isFollowable(npc) && (
            <button
              onClick={() => (npc.followedByPlayer ? unfollowNpc(npc.id) : followNpc(npc.id))}
              className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                npc.followedByPlayer
                  ? 'border border-neutral-300 text-neutral-900 hover:border-rose-400 hover:text-rose-600 dark:border-neutral-700 dark:text-neutral-100'
                  : 'bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200'
              }`}
            >
              {npc.followedByPlayer ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
