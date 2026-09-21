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

type Tab = 'overview' | 'posts' | 'replies'

export function Profile({ profileId, onOpenProfile, onOpenThread, onOpenDM, onBack, onOpenSettings }: ProfileProps) {
  const profile = useGameStore((s) => s.profiles[profileId])
  const player = useGameStore((s) => s.player)
  const posts = useGameStore((s) => s.posts)
  const postOrder = useGameStore((s) => s.postOrder)
  const followNpc = useGameStore((s) => s.followNpc)
  const unfollowNpc = useGameStore((s) => s.unfollowNpc)
  const [tab, setTab] = useState<Tab>('overview')

  // Posts tab covers both feed posts and stories — a full record of
  // everything this profile has put out, regardless of story expiry.
  const authoredPostAndStoryIds = useMemo(
    () =>
      postOrder.filter(
        (id) => posts[id]?.authorId === profileId && (posts[id]?.kind === 'post' || posts[id]?.kind === 'story'),
      ),
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
          <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        )}
        <div className="flex-1">
          <p className="text-[15px] font-semibold leading-tight">{profile.displayName}</p>
          <p className="text-xs text-neutral-500">{authoredPostAndStoryIds.length} posts</p>
        </div>
        {profile.isPlayer && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
      </div>

      <div className="mt-4 flex border-b border-neutral-200 text-sm font-medium dark:border-neutral-800">
        {(['overview', 'posts', 'replies'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-fuchsia-500 text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="px-4 py-4">
          {npc && <RelationshipMeter relationship={npc.relationship} vibe={npc.vibe} />}

          {profile.isPlayer && (
            <>
              <h2 className="text-sm font-semibold text-neutral-500">Social Media Presence</h2>
              <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                <StatBar emoji="😂" label="Humor" value={player.humor} change={player.lastHumorChange} />
                <StatBar emoji="🌟" label="Aura" value={player.aura} change={player.lastAuraChange} />
              </div>

              <div className="mt-4">
                <RelationshipList onOpenProfile={onOpenProfile} />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'posts' &&
        (authoredPostAndStoryIds.length > 0 ? (
          authoredPostAndStoryIds.map((id) => (
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
    </div>
  )
}

interface StatBarProps {
  emoji: string
  label: string
  value: number
  change?: { delta: number; reason: string }
}

// A single Humor/Aura row: emoji + label, percentage (with a colored delta
// when it just moved), a progress bar, and a caption naming what moved it —
// same visual language as RelationshipList's cards, just for the player's
// own stats instead of a relationship.
function StatBar({ emoji, label, value, change }: StatBarProps) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {emoji} {label}
        </span>
        <span className="flex items-center gap-1.5">
          {change && change.delta !== 0 && (
            <span
              className={`text-xs font-semibold ${
                change.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {change.delta > 0 ? '+' : ''}
              {change.delta}%
            </span>
          )}
          <span className="font-semibold">{pct}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {change?.reason && <p className="mt-1.5 truncate text-xs text-neutral-500">{change.reason}</p>}
    </div>
  )
}
