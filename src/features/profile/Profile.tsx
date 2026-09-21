import { useMemo, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { CenteredBar } from '../../components/CenteredBar'
import { formatCompactNumber } from '../../components/formatCompactNumber'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { PostCard } from '../../components/PostCard'
import { RelationshipMeter } from '../../components/RelationshipMeter'
import { RelationshipList } from '../../components/RelationshipList'
import { EditProfile } from './EditProfile'
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
  const [editingProfile, setEditingProfile] = useState(false)

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

  if (editingProfile) return <EditProfile onBack={() => setEditingProfile(false)} />

  const npc = isNPC(profile) ? profile : null

  return (
    <div className="h-full overflow-y-auto">
      {!profile.isPlayer && (
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
          {onBack && (
            <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1">
            <p className="text-[15px] font-semibold leading-tight">{profile.displayName}</p>
            <p className="text-xs text-neutral-500">{authoredPostAndStoryIds.length} posts</p>
          </div>
        </div>
      )}

      <div
        className="relative z-0 h-24 bg-gradient-to-r from-blue-600/70 to-sky-600/70 bg-cover bg-center"
        style={profile.bannerImage ? { backgroundImage: `url(${profile.bannerImage})` } : undefined}
      >
        {profile.isPlayer && onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="absolute left-3 top-3 cursor-pointer rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        )}
        {profile.isPlayer && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            className="absolute right-3 top-3 cursor-pointer rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="relative z-10 px-4">
        <div className="-mt-10 flex items-end justify-between">
          <div className="rounded-full ring-4 ring-white dark:ring-neutral-900">
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
          {profile.isPlayer && (
            <button
              onClick={() => setEditingProfile(true)}
              className="mb-2 cursor-pointer rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Edit Profile
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1">
          <h1 className="text-xl font-bold">{profile.displayName}</h1>
          {profile.verified && <VerifiedBadge />}
        </div>
        <p className="text-sm text-neutral-500">@{profile.username}</p>
        <p className="mt-2 text-[15px]">{profile.bio}</p>

        <div className="mt-3 text-sm">
          <span className="font-semibold text-neutral-900 dark:text-white">{formatCompactNumber(profile.followers)}</span>{' '}
          <span className="text-neutral-500">Followers</span>{' '}
          {profile.lastFollowerChange && profile.lastFollowerChange.delta !== 0 && (
            <span
              className={`font-semibold ${
                profile.lastFollowerChange.delta > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {profile.lastFollowerChange.delta > 0 ? '+' : ''}
              {formatCompactNumber(profile.lastFollowerChange.delta)}
            </span>
          )}
          {profile.lastFollowerChange?.reason && (
            <p className="mt-0.5 truncate text-xs text-neutral-900 dark:text-white">
              {profile.lastFollowerChange.reason}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex border-b border-neutral-200 text-sm font-medium dark:border-neutral-800">
        {(['overview', 'posts', 'replies'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-blue-500 text-blue-500 dark:text-blue-400'
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
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Social Media Presence</h2>
              <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800 dark:bg-neutral-800">
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

// A single Humor/Aura row: emoji + label, a progress bar with its
// percentage to the right, then a second row with the caption naming what
// most recently moved it and the +/- delta lined up under that
// percentage — same visual language as RelationshipList's cards, just for
// the player's own stats instead of a relationship.
function StatBar({ emoji, label, value, change }: StatBarProps) {
  const pct = Math.max(0, Math.min(100, value))
  // Humor/Aura are 0..100 with 50 as the neutral midpoint — scale onto the
  // same -100..100 frame CenteredBar expects for relationships, so 50
  // renders dead center, 100 fully right (green), 0 fully left (red).
  const centered = (pct - 50) * 2
  return (
    <div>
      <span className="text-sm font-medium">
        {emoji} {label}
      </span>
      <div className="mt-1.5 flex items-center gap-2">
        <CenteredBar value={centered} className="flex-1" />
        <span className="shrink-0 text-xs font-semibold text-neutral-900 dark:text-white">{centered}%</span>
      </div>
      {change?.reason && (
        <div className="mt-1 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-neutral-900 dark:text-white">{change.reason}</p>
          {change.delta !== 0 && (
            <span
              className={`shrink-0 text-xs font-semibold ${
                change.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {change.delta > 0 ? '+' : ''}
              {change.delta * 2}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}
