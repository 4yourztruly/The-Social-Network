import { useCallback, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { PostCard } from '../../components/PostCard'
import { PostText } from '../../components/PostText'
import { Avatar } from '../../components/Avatar'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { ArrowLeftIcon, ChevronRightIcon, HeartIcon, ReplyIcon, RepostIcon } from '../../components/icons'
import { formatFullTime } from '../../engine/time'
import { isNPC } from '../../types'
import { isViewableProfile } from '../../engine/npcTier'
import { PLAYER_ID } from '../../store/gameStore'

interface PostThreadProps {
  postId: string
  onOpenProfile: (profileId: string) => void
  onBack: () => void
}

export function PostThread({ postId, onOpenProfile, onBack }: PostThreadProps) {
  const post = useGameStore((s) => s.posts[postId])
  const author = useGameStore((s) => s.profiles[post?.authorId ?? ''])
  const posts = useGameStore((s) => s.posts)
  const postOrder = useGameStore((s) => s.postOrder)
  const player = useGameStore((s) => s.profiles[PLAYER_ID])
  const addPlayerReply = useGameStore((s) => s.addPlayerReply)
  const toggleLike = useGameStore((s) => s.toggleLike)
  const [replyText, setReplyText] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const replyInputRef = useRef<HTMLInputElement>(null)

  const replyIds = useMemo(
    () =>
      postOrder
        .filter((id) => posts[id]?.parentId === postId)
        .sort((a, b) => (posts[a]?.createdAt ?? 0) - (posts[b]?.createdAt ?? 0)),
    [postOrder, posts, postId],
  )

  const handleReply = () => {
    if (!replyText.trim()) return
    addPlayerReply(postId, replyText)
    setReplyText('')
  }

  const handleLike = useCallback(() => {
    if (post) toggleLike(post.id)
  }, [toggleLike, post])

  const handleOpenAuthorProfile = useCallback(() => {
    if (author) onOpenProfile(author.id)
  }, [author, onOpenProfile])

  const focusReplyInput = useCallback(() => replyInputRef.current?.focus(), [])

  if (!post || !author || !player) return null

  // Commenter-tier NPCs (the general public) have no viewable profile —
  // see engine/npcTier.ts — so their name/avatar render as plain text.
  const profileViewable = !isNPC(author) || isViewableProfile(author)

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
        <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Post</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            {profileViewable ? (
              <button onClick={handleOpenAuthorProfile} className="shrink-0 cursor-pointer">
                <Avatar avatar={author.avatar} seed={author.id} size={48} />
              </button>
            ) : (
              <div className="shrink-0">
                <Avatar avatar={author.avatar} seed={author.id} size={48} />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                {profileViewable ? (
                  <button
                    onClick={handleOpenAuthorProfile}
                    className="cursor-pointer truncate font-bold text-neutral-900 hover:underline dark:text-neutral-100"
                  >
                    {author.displayName}
                  </button>
                ) : (
                  <span className="truncate font-bold text-neutral-900 dark:text-neutral-100">{author.displayName}</span>
                )}
                {author.verified && <VerifiedBadge />}
              </div>
              <p className="truncate text-[15px] text-neutral-500">@{author.username}</p>
            </div>
            <button
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand post' : 'Collapse post'}
              className="ml-auto shrink-0 cursor-pointer rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ChevronRightIcon className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-90' : '-rotate-90'}`} />
            </button>
          </div>

          {!collapsed && (
            <>
              <PostText
                text={post.text}
                onOpenProfile={onOpenProfile}
                className="mt-3 whitespace-pre-wrap break-words text-xl leading-snug text-neutral-900 dark:text-neutral-100"
              />

              <p className="mt-3 text-sm text-neutral-500">{formatFullTime(post.createdAt)}</p>

              <div className="mt-3 flex items-center gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <button
                  onClick={focusReplyInput}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-600"
                >
                  <ReplyIcon className="h-4 w-4" />
                  Reply
                </button>
                <span className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
                  <RepostIcon className="h-4 w-4" />
                  {post.reposts}
                </span>
                <button
                  onClick={handleLike}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    post.likedByPlayer
                      ? 'border-rose-300 text-rose-500'
                      : 'border-neutral-300 text-neutral-700 hover:border-rose-300 hover:text-rose-500 dark:border-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <HeartIcon className="h-4 w-4" filled={!!post.likedByPlayer} />
                  {post.likes}
                </button>
              </div>
            </>
          )}
        </div>

        {replyIds.length > 0 ? (
          replyIds.map((id) => <PostCard key={id} postId={id} onOpenProfile={onOpenProfile} />)
        ) : (
          <p className="p-8 text-center text-sm text-neutral-500">No replies yet. Be the first.</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <Avatar avatar={player.avatar} seed={player.id} size={32} />
        <input
          ref={replyInputRef}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value.slice(0, 280))}
          onKeyDown={(e) => e.key === 'Enter' && handleReply()}
          placeholder="Post your reply"
          className="min-w-0 flex-1 bg-transparent text-[15px] placeholder-neutral-500 outline-none"
        />
        <button
          onClick={handleReply}
          disabled={!replyText.trim()}
          className="shrink-0 rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          Reply
        </button>
      </div>
    </div>
  )
}
