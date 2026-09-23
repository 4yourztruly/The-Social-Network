import { useCallback, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { PostCard } from '../../components/PostCard'
import { PostText } from '../../components/PostText'
import { Avatar } from '../../components/Avatar'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { ArrowLeftIcon, ChevronRightIcon, HeartIcon, ReplyIcon, RepostIcon } from '../../components/icons'
import { formatFullTime } from '../../engine/time'
import { formatCompactNumber } from '../../components/formatCompactNumber'
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
  const profiles = useGameStore((s) => s.profiles)
  const addPlayerReply = useGameStore((s) => s.addPlayerReply)
  const toggleLike = useGameStore((s) => s.toggleLike)
  const [replyText, setReplyText] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [composerTarget, setComposerTarget] = useState<{ id: string; username: string } | null>(null)
  const [composerText, setComposerText] = useState('')
  const replyInputRef = useRef<HTMLInputElement>(null)

  // Replies nest — a reply to a reply is a genuine child of that reply, not
  // just another flat item under the top-level post. Walked depth-first so
  // each node knows how deep to indent, and each parent's own children stay
  // grouped together (chronological within a parent) instead of interleaved
  // by global timestamp.
  const threadNodes = useMemo(() => {
    const childrenByParent = new Map<string, string[]>()
    for (const id of postOrder) {
      const parentId = posts[id]?.parentId
      if (!parentId) continue
      const list = childrenByParent.get(parentId)
      if (list) list.push(id)
      else childrenByParent.set(parentId, [id])
    }
    for (const list of childrenByParent.values()) {
      list.sort((a, b) => (posts[a]?.createdAt ?? 0) - (posts[b]?.createdAt ?? 0))
    }
    const result: { id: string; depth: number }[] = []
    const visit = (parentId: string, depth: number) => {
      for (const childId of childrenByParent.get(parentId) ?? []) {
        result.push({ id: childId, depth })
        visit(childId, depth + 1)
      }
    }
    visit(postId, 0)
    return result
  }, [postOrder, posts, postId])

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

  // Replying to a comment opens a small composer prefilled with
  // @whoever-wrote-it, and the result nests directly under THAT comment
  // (a genuine child, not flattened onto the top-level post) — see
  // threadNodes above.
  const handleOpenComposer = useCallback(
    (targetPostId: string) => {
      const targetAuthor = profiles[posts[targetPostId]?.authorId ?? '']
      if (!targetAuthor) return
      setComposerTarget({ id: targetPostId, username: targetAuthor.username })
      setComposerText(`@${targetAuthor.username} `)
    },
    [posts, profiles],
  )
  const closeComposer = useCallback(() => {
    setComposerTarget(null)
    setComposerText('')
  }, [])
  const handleSubmitComposer = () => {
    if (!composerText.trim() || !composerTarget) return
    addPlayerReply(composerTarget.id, composerText)
    closeComposer()
  }

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
            </>
          )}

          <div
            className={`mt-3 flex items-center gap-2 ${
              collapsed ? '' : 'border-t border-neutral-200 pt-3 dark:border-neutral-800'
            }`}
          >
            <button
              onClick={focusReplyInput}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-600"
            >
              <ReplyIcon className="h-4 w-4" />
              Reply
            </button>
            <span className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
              <RepostIcon className="h-4 w-4" />
              {formatCompactNumber(post.reposts)}
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
              {formatCompactNumber(post.likes)}
            </button>
          </div>
        </div>

        {threadNodes.length > 0 ? (
          threadNodes.map(({ id, depth }) => (
            <div
              key={id}
              style={depth > 0 ? { marginLeft: Math.min(depth, 6) * 20 } : undefined}
              className={depth > 0 ? 'border-l-2 border-neutral-100 dark:border-neutral-800' : undefined}
            >
              <PostCard postId={id} onOpenProfile={onOpenProfile} onReply={handleOpenComposer} />
            </div>
          ))
        ) : (
          <p className="p-8 text-center text-sm text-neutral-500">No replies yet. Be the first.</p>
        )}
      </div>

      {composerTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={closeComposer}
        >
          <div
            className="w-full max-w-xl rounded-t-2xl bg-white p-4 dark:bg-neutral-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Avatar avatar={player.avatar} seed={player.id} size={40} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-neutral-900 dark:text-neutral-100">{player.displayName}</p>
                <p className="truncate text-sm text-neutral-500">@{player.username}</p>
              </div>
            </div>
            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value.slice(0, 280))}
              autoFocus
              rows={3}
              className="mt-3 w-full resize-none rounded-xl border border-neutral-300 bg-transparent p-2 text-[15px] outline-none dark:border-neutral-700"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleSubmitComposer}
                disabled={!composerText.trim()}
                className="cursor-pointer rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}

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
