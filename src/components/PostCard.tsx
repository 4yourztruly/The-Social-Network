import { memo, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { Avatar } from './Avatar'
import { VerifiedBadge } from './VerifiedBadge'
import { formatRelativeTime } from '../engine/time'
import { HeartIcon, ReplyIcon, RepostIcon, StarIcon } from './icons'
import { PostText } from './PostText'
import { isNPC } from '../types'
import { isViewableProfile } from '../engine/npcTier'
import { formatCompactNumber } from './formatCompactNumber'

interface PostCardProps {
  postId: string
  onOpenProfile: (profileId: string) => void
  onOpenThread?: (postId: string) => void
  // Only used for a reply-kind post's own "Reply" text link — replying to a
  // reply doesn't open a new thread (there's no nested view), it opens a
  // compose prefilled with @whoever-wrote-that-comment. See PostThread.
  onReply?: (postId: string) => void
}

function PostCardImpl({ postId, onOpenProfile, onOpenThread, onReply }: PostCardProps) {
  const post = useGameStore((s) => s.posts[postId])
  const author = useGameStore((s) => s.profiles[post?.authorId ?? ''])
  const toggleLike = useGameStore((s) => s.toggleLike)

  const handleLike = useCallback(() => toggleLike(postId), [toggleLike, postId])
  const handleOpenProfile = useCallback(() => {
    if (author) onOpenProfile(author.id)
  }, [author, onOpenProfile])
  const handleOpenThread = useCallback(() => onOpenThread?.(postId), [onOpenThread, postId])
  const handleReply = useCallback(() => onReply?.(postId), [onReply, postId])

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
  const handleReplyStopped = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      handleReply()
    },
    [handleReply],
  )

  if (!post || !author) return null

  // Commenter-tier NPCs (the general public) have no viewable profile —
  // see engine/npcTier.ts. Their name/avatar render as plain text instead
  // of a dead-end button that looks clickable but does nothing.
  const profileViewable = !isNPC(author) || isViewableProfile(author)
  const isReply = post.kind === 'reply'

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
      {profileViewable ? (
        <button onClick={handleOpenProfileStopped} className="shrink-0 cursor-pointer">
          <Avatar avatar={author.avatar} seed={author.id} />
        </button>
      ) : (
        <div className="shrink-0">
          <Avatar avatar={author.avatar} seed={author.id} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[15px]">
          {profileViewable ? (
            <button
              onClick={handleOpenProfileStopped}
              className="cursor-pointer truncate font-semibold text-neutral-900 hover:underline dark:text-neutral-100"
            >
              {author.displayName}
            </button>
          ) : (
            <span className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
              {author.displayName}
            </span>
          )}
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
        {isReply ? (
          <div className="mt-2 flex items-center gap-2 text-neutral-500">
            <button
              onClick={handleLikeStopped}
              className={`flex cursor-pointer items-center gap-1.5 text-xs transition-colors ${
                post.likedByPlayer ? 'text-rose-500' : 'hover:text-rose-500'
              }`}
            >
              <HeartIcon className="h-[18px] w-[18px]" filled={!!post.likedByPlayer} />
              {formatCompactNumber(post.likes)}
            </button>
            {post.reposts > 0 && (
              <span className="flex items-center gap-1.5 text-xs">
                <RepostIcon className="h-[18px] w-[18px]" />
                {formatCompactNumber(post.reposts)}
              </span>
            )}
            <span className="text-xs">|</span>
            <button
              onClick={handleReplyStopped}
              disabled={!onReply}
              className="cursor-pointer text-xs hover:text-sky-500"
            >
              Reply
            </button>
            <StarIcon className="ml-auto h-[18px] w-[18px] shrink-0" />
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-5 text-neutral-500">
            <button
              onClick={handleOpenThreadStopped}
              disabled={!onOpenThread}
              className="flex cursor-pointer items-center gap-1.5 text-xs hover:text-sky-500"
            >
              <ReplyIcon className="h-[18px] w-[18px]" />
              {formatCompactNumber(post.replies)}
            </button>
            <span className="flex items-center gap-1.5 text-xs">
              <RepostIcon className="h-[18px] w-[18px]" />
              {formatCompactNumber(post.reposts)}
            </span>
            <button
              onClick={handleLikeStopped}
              className={`flex cursor-pointer items-center gap-1.5 text-xs transition-colors ${
                post.likedByPlayer ? 'text-rose-500' : 'hover:text-rose-500'
              }`}
            >
              <HeartIcon className="h-[18px] w-[18px]" filled={!!post.likedByPlayer} />
              {formatCompactNumber(post.likes)}
            </button>
            <StarIcon className="ml-auto h-[18px] w-[18px] shrink-0" />
          </div>
        )}
      </div>
    </article>
  )
}

export const PostCard = memo(PostCardImpl)
