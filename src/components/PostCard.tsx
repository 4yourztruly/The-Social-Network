import { memo, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { Avatar } from './Avatar'
import { VerifiedBadge } from './VerifiedBadge'
import { formatRelativeTime } from '../engine/time'
import { HeartIcon, ReplyIcon, RepostIcon, StarIcon } from './icons'
import { PostText } from './PostText'

interface PostCardProps {
  postId: string
  onOpenProfile: (profileId: string) => void
  onOpenThread?: (postId: string) => void
}

function PostCardImpl({ postId, onOpenProfile, onOpenThread }: PostCardProps) {
  const post = useGameStore((s) => s.posts[postId])
  const author = useGameStore((s) => s.profiles[post?.authorId ?? ''])
  const toggleLike = useGameStore((s) => s.toggleLike)

  const handleLike = useCallback(() => toggleLike(postId), [toggleLike, postId])
  const handleOpenProfile = useCallback(() => {
    if (author) onOpenProfile(author.id)
  }, [author, onOpenProfile])
  const handleOpenThread = useCallback(() => onOpenThread?.(postId), [onOpenThread, postId])

  // Sub-elements inside the now fully-clickable row (avatar, name, reply,
  // like) need to stop the click from also bubbling up to the row's own
  // "open thread" handler.
  const handleOpenProfileStopped = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      handleOpenProfile()
    },
    [handleOpenProfile],
  )
  const handleOpenThreadStopped = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      handleOpenThread()
    },
    [handleOpenThread],
  )
  const handleLikeStopped = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      handleLike()
    },
    [handleLike],
  )

  if (!post || !author) return null

  return (
    <article
      onClick={onOpenThread ? handleOpenThread : undefined}
      role={onOpenThread ? 'button' : undefined}
      tabIndex={onOpenThread ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOpenThread && (e.key === 'Enter' || e.key === ' ')) handleOpenThread()
      }}
      className={`flex gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 ${
        onOpenThread ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/60' : ''
      }`}
    >
      <button onClick={handleOpenProfileStopped} className="shrink-0 cursor-pointer">
        <Avatar avatar={author.avatar} seed={author.id} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[15px]">
          <button
            onClick={handleOpenProfileStopped}
            className="cursor-pointer truncate font-semibold text-neutral-900 hover:underline dark:text-neutral-100"
          >
            {author.displayName}
          </button>
          {author.verified && <VerifiedBadge />}
          <span className="truncate text-neutral-500">@{author.username}</span>
          <span className="text-neutral-500">·</span>
          <span className="shrink-0 text-neutral-500">{formatRelativeTime(post.createdAt)}</span>
        </div>
        <PostText
          text={post.text}
          onOpenProfile={onOpenProfile}
          className="mt-0.5 whitespace-pre-wrap break-words text-[15px] text-neutral-900 dark:text-neutral-100"
        />
        <div className="mt-2 flex items-center gap-5 text-neutral-500">
          <button
            onClick={handleOpenThreadStopped}
            disabled={!onOpenThread}
            className="flex cursor-pointer items-center gap-1.5 text-xs hover:text-sky-500"
          >
            <ReplyIcon className="h-[18px] w-[18px]" />
            {post.replies}
          </button>
          <span className="flex items-center gap-1.5 text-xs">
            <RepostIcon className="h-[18px] w-[18px]" />
            {post.reposts}
          </span>
          <button
            onClick={handleLikeStopped}
            className={`flex cursor-pointer items-center gap-1.5 text-xs transition-colors ${
              post.likedByPlayer ? 'text-rose-500' : 'hover:text-rose-500'
            }`}
          >
            <HeartIcon className="h-[18px] w-[18px]" filled={!!post.likedByPlayer} />
            {post.likes}
          </button>
          <StarIcon className="ml-auto h-[18px] w-[18px] shrink-0" />
        </div>
      </div>
    </article>
  )
}

export const PostCard = memo(PostCardImpl)
