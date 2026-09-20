import { useMemo, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { PostCard } from '../../components/PostCard'
import { RelationshipMeter } from '../../components/RelationshipMeter'
import { RelationshipList } from '../../components/RelationshipList'
import { ArrowLeftIcon, MailIcon, SettingsIcon } from '../../components/icons'

interface ProfileProps {
  profileId: string
  onOpenProfile: (profileId: string) => void
  onOpenThread: (postId: string) => void
  onOpenDM?: (npcId: string) => void
  onBack?: () => void
  onOpenSettings?: () => void
}

type Tab = 'posts' | 'replies' | 'stories'

// Rating keys are career-specific snake_case (finishing, vocals, arm_strength,
// ...) — prettify generically instead of hard-coding one career's labels.
function prettifyStatKey(key: string): string {
  return key
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

export function Profile({ profileId, onOpenProfile, onOpenThread, onOpenDM, onBack, onOpenSettings }: ProfileProps) {
  const profile = useGameStore((s) => s.profiles[profileId])
  const player = useGameStore((s) => s.player)
  const posts = useGameStore((s) => s.posts)
  const postOrder = useGameStore((s) => s.postOrder)
  const followNpc = useGameStore((s) => s.followNpc)
  const unfollowNpc = useGameStore((s) => s.unfollowNpc)
  const [tab, setTab] = useState<Tab>('posts')

  const authoredPostIds = useMemo(
    () => postOrder.filter((id) => posts[id]?.authorId === profileId && posts[id]?.kind === 'post'),
    [postOrder, posts, profileId],
  )

  const authoredReplyIds = useMemo(
    () => postOrder.filter((id) => posts[id]?.authorId === profileId && posts[id]?.kind === 'reply'),
    [postOrder, posts, profileId],
  )

  if (!profile) return null

  const npc = isNPC(profile) ? profile : null

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        {onBack && (
          <button onClick={onBack} className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        )}
        <div className="flex-1">
          <p className="text-[15px] font-semibold leading-tight">{profile.displayName}</p>
          <p className="text-xs text-neutral-500">{authoredPostIds.length} posts</p>
        </div>
        {profile.isPlayer && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="h-24 bg-gradient-to-r from-fuchsia-600/70 to-sky-600/70" />

      <div className="px-4">
        <div className="-mt-10 flex items-end justify-between">
          <div className="rounded-full ring-4 ring-white dark:ring-neutral-950">
            <Avatar avatar={profile.avatar} seed={profile.id} size={80} />
          </div>
          {npc && (
            <div className="mb-2 flex gap-2">
              {onOpenDM && (
                <button
                  onClick={() => onOpenDM(npc.id)}
                  className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  <MailIcon className="h-4 w-4" />
                  Message
                </button>
              )}
              <button
                onClick={() => (npc.followedByPlayer ? unfollowNpc(npc.id) : followNpc(npc.id))}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  npc.followedByPlayer
                    ? 'border border-neutral-300 text-neutral-900 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-rose-950/40'
                    : 'bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200'
                }`}
              >
                {npc.followedByPlayer ? 'Following' : 'Follow'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1">
          <h1 className="text-xl font-bold">{profile.displayName}</h1>
          {profile.verified && <VerifiedBadge />}
        </div>
        <p className="text-sm text-neutral-500">@{profile.username}</p>
        <p className="mt-2 text-[15px]">{profile.bio}</p>

        <div className="mt-3 flex gap-4 text-sm">
          <span>
            <span className="font-semibold">{profile.following.toLocaleString()}</span>{' '}
            <span className="text-neutral-500">Following</span>
          </span>
          <span>
            <span className="font-semibold">{profile.followers.toLocaleString()}</span>{' '}
            <span className="text-neutral-500">Followers</span>
          </span>
        </div>

        {npc && <RelationshipMeter relationship={npc.relationship} vibe={npc.vibe} />}

        {profile.isPlayer && (
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-neutral-200 p-3 text-center text-sm dark:border-neutral-800">
            <Stat label="Fame" value={player.fame} />
            <Stat label="Morale" value={player.morale} />
            <Stat label="Form" value={player.form} />
            <Stat label="Hype" value={player.hype} />
            <Stat label="Charisma" value={player.charisma} />
            <Stat label="Reputation" value={player.reputation} />
            <Stat label="Humor" value={player.humor} />
            <Stat label="Aura" value={player.aura} />
          </div>
        )}

        {profile.isPlayer && <ControversyMeter value={player.controversy} />}

        {profile.isPlayer && <RelationshipList onOpenProfile={onOpenProfile} />}

        {profile.isPlayer && (
          <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
            {Object.entries(player.ratings).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-neutral-500">{prettifyStatKey(key)}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex border-b border-neutral-200 text-sm font-medium dark:border-neutral-800">
        {(['posts', 'replies', 'stories'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-fuchsia-500 text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            {t === 'stories' ? 'Stories highlights' : t}
          </button>
        ))}
      </div>

      {tab === 'posts' &&
        (authoredPostIds.length > 0 ? (
          authoredPostIds.map((id) => (
            <PostCard key={id} postId={id} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
          ))
        ) : (
          <p className="p-8 text-center text-sm text-neutral-500">No posts yet.</p>
        ))}
      {tab === 'replies' &&
        (authoredReplyIds.length > 0 ? (
          authoredReplyIds.map((id) => (
            <PostCard
              key={id}
              postId={id}
              onOpenProfile={onOpenProfile}
              onOpenThread={() => onOpenThread(posts[id]?.parentId ?? id)}
            />
          ))
        ) : (
          <p className="p-8 text-center text-sm text-neutral-500">No replies yet.</p>
        ))}
      {tab === 'stories' && <p className="p-8 text-center text-sm text-neutral-500">No story highlights yet.</p>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  )
}

function ControversyMeter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  const color = clamped >= 70 ? 'bg-rose-500' : clamped >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Controversy</span>
        <span>{clamped}/100</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full ${color} transition-[width]`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}
