import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore, PLAYER_ID } from '../../store/gameStore'
import { isNPC } from '../../types'
import { isDmAvailable } from '../../engine/npcTier'
import { Avatar } from '../../components/Avatar'
import { gradientCssFor } from '../../components/avatarColors'
import { shortNameFor } from '../../components/shortName'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { formatRelativeTime } from '../../engine/time'
import { useActiveStoryAuthors } from './useActiveStoryAuthors'
import { ReplyIcon } from '../../components/icons'
import { isViewableProfile } from '../../engine/npcTier'
import { MentionText } from '../../components/MentionText'

const STORY_DURATION_MS = 5000

interface StoryViewerProps {
  authorId: string
  viewedAuthorIds: ReadonlySet<string>
  onMarkViewed: (authorId: string) => void
  onChangeAuthor: (authorId: string) => void
  onClose: () => void
  onOpenProfile?: (profileId: string) => void
}

export function StoryViewer({ authorId, viewedAuthorIds, onMarkViewed, onChangeAuthor, onClose, onOpenProfile }: StoryViewerProps) {
  const posts = useGameStore((s) => s.posts)
  const postOrder = useGameStore((s) => s.postOrder)
  const profiles = useGameStore((s) => s.profiles)
  const sendPlayerMessage = useGameStore((s) => s.sendPlayerMessage)
  const finishDmSession = useGameStore((s) => s.finishDmSession)
  const addPlayerReply = useGameStore((s) => s.addPlayerReply)
  const player = useGameStore((s) => s.profiles[PLAYER_ID])
  const authorIds = useActiveStoryAuthors(viewedAuthorIds)
  const [storyIndex, setStoryIndex] = useState(0)
  const [replyText, setReplyText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentTarget, setCommentTarget] = useState<{ id: string; username: string } | null>(null)
  // Press-and-hold pauses the story (progress bar + auto-advance), like
  // Instagram — a quick tap still navigates, a sustained press just pauses
  // and resumes on release without jumping anywhere.
  const [held, setHeld] = useState(false)
  const [replyFocused, setReplyFocused] = useState(false)
  const pointerDownAtRef = useRef(0)
  const HOLD_THRESHOLD_MS = 200

  const stories = useMemo(() => {
    const now = Date.now()
    return postOrder
      .map((id) => posts[id])
      .filter((p) => p && p.authorId === authorId && p.kind === 'story' && p.expiresAt && p.expiresAt > now)
      .sort((a, b) => a!.createdAt - b!.createdAt) as NonNullable<(typeof posts)[string]>[]
  }, [postOrder, posts, authorId])

  const author = profiles[authorId]
  const story = stories[storyIndex]
  const authorPos = authorIds.indexOf(authorId)

  // A reply can target any comment (prefilling "@whoever-it-was" in the
  // composer), but the panel always renders one flat, chronological list —
  // not indented by who-replied-to-whom — so several people replying to the
  // same comment (or to each other) reads top to bottom like the rest of
  // the app's comments, not as a sideways-marching tree.
  const { commentIds, commentCount } = useMemo(() => {
    if (!story) return { commentIds: [] as string[], commentCount: 0 }
    const childrenByParent = new Map<string, string[]>()
    for (const id of postOrder) {
      const parentId = posts[id]?.parentId
      if (!parentId) continue
      const list = childrenByParent.get(parentId)
      if (list) list.push(id)
      else childrenByParent.set(parentId, [id])
    }
    const result: string[] = []
    const visit = (parentId: string) => {
      for (const childId of childrenByParent.get(parentId) ?? []) {
        result.push(childId)
        visit(childId)
      }
    }
    visit(story.id)
    result.sort((a, b) => (posts[a]?.createdAt ?? 0) - (posts[b]?.createdAt ?? 0))
    return { commentIds: result, commentCount: result.length }
  }, [postOrder, posts, story])

  useEffect(() => {
    setStoryIndex(0)
    setShowComments(false)
  }, [authorId])

  useEffect(() => {
    if (!story) return
    onMarkViewed(authorId)
  }, [authorId, story, onMarkViewed])

  const goNext = () => {
    if (storyIndex < stories.length - 1) {
      setStoryIndex((i) => i + 1)
      return
    }
    // Past this person's last story: jump to the next person whose story
    // hasn't been watched yet (the current author is already marked viewed),
    // and close once everyone's been seen.
    const nextUnwatched = authorIds.find((id) => id !== authorId && !viewedAuthorIds.has(id))
    if (nextUnwatched) onChangeAuthor(nextUnwatched)
    else onClose()
  }

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1)
      return
    }
    const prevAuthor = authorIds[authorPos - 1]
    if (prevAuthor) onChangeAuthor(prevAuthor)
  }

  // The story freezes — progress bar and auto-advance both — while the
  // player is holding the screen, reading/typing in the comments panel, or
  // focused/typing in the reply box. Anything else would silently redirect
  // their message to whoever's story comes next, yank a panel closed, or
  // skip a story they were still reading.
  const paused = held || showComments || replyFocused || replyText.length > 0 || commentText.length > 0

  // Time already spent on the current story, so resuming after a pause
  // continues from where the bar stopped instead of restarting the timer.
  const elapsedRef = useRef(0)
  useEffect(() => {
    elapsedRef.current = 0
  }, [story?.id])

  useEffect(() => {
    if (!story || paused) return
    const startedAt = Date.now()
    const timer = setTimeout(goNext, Math.max(0, STORY_DURATION_MS - elapsedRef.current))
    return () => {
      clearTimeout(timer)
      elapsedRef.current += Date.now() - startedAt
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId, storyIndex, story?.id, paused])

  const handleReply = () => {
    if (!replyText.trim() || authorId === PLAYER_ID) return
    const before = useGameStore.getState().threads[authorId]?.messages.length ?? 0
    sendPlayerMessage(authorId, replyText)
    // A reply to a story is its own one-off chat — report card right away.
    finishDmSession(authorId, before)
    setReplyText('')
  }

  const handleComment = () => {
    if (!commentText.trim() || !story) return
    addPlayerReply(commentTarget?.id ?? story.id, commentText)
    setCommentText('')
    setCommentTarget(null)
  }

  const handleReplyToComment = (targetId: string) => {
    const targetAuthor = profiles[posts[targetId]?.authorId ?? '']
    if (!targetAuthor) return
    setCommentTarget({ id: targetId, username: targetAuthor.username })
    setCommentText(`@${targetAuthor.username} `)
  }

  const handlePointerDown = () => {
    pointerDownAtRef.current = Date.now()
    setHeld(true)
  }
  const handlePointerUp = () => setHeld(false)
  const wasQuickTap = () => Date.now() - pointerDownAtRef.current < HOLD_THRESHOLD_MS
  const handleTapPrev = () => {
    if (wasQuickTap()) goPrev()
  }
  const handleTapNext = () => {
    if (wasQuickTap()) goNext()
  }

  if (!author || !story) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex select-none justify-center bg-black"
      style={{ WebkitTouchCallout: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="relative flex h-full w-full max-w-xl flex-col text-white"
        style={{
          background: gradientCssFor(story.id),
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex gap-1 px-3 pt-3">
          {stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={
                  i < storyIndex
                    ? { width: '100%' }
                    : i === storyIndex
                      ? {
                          width: '100%',
                          animation: `story-progress ${STORY_DURATION_MS}ms linear forwards`,
                          animationPlayState: paused ? 'paused' : 'running',
                        }
                      : { width: '0%' }
                }
              />
            </div>
          ))}
        </div>
        <style>{'@keyframes story-progress { from { width: 0% } to { width: 100% } }'}</style>

        <div className="flex items-center gap-2 px-3 py-3">
          <Avatar avatar={author.avatar} seed={author.id} size={32} />
          <span className="flex items-center gap-1 text-sm font-semibold">
            {authorId === PLAYER_ID ? 'Your story' : author.displayName}
            {author.verified && <VerifiedBadge />}
          </span>
          <span className="text-xs text-white/70">{formatRelativeTime(story.createdAt)}</span>
          <button onClick={onClose} className="ml-auto rounded-full p-2.5 text-xl leading-none hover:bg-white/10">
            ×
          </button>
        </div>

        <div className="relative flex flex-1 items-center justify-center px-8">
          <button
            aria-label="Previous"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handleTapPrev}
            className="absolute inset-y-0 left-0 w-1/3"
          />
          <button
            aria-label="Next"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handleTapNext}
            className="absolute inset-y-0 right-0 w-1/3"
          />
          <p className="text-center text-2xl font-semibold leading-snug drop-shadow">{story.text}</p>
        </div>

        <div className="flex flex-col gap-2 px-3 pb-10">
          {authorId !== PLAYER_ID && isNPC(author) && isDmAvailable(author) && (
            <div className="flex items-center gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value.slice(0, 280))}
                onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                onFocus={() => setReplyFocused(true)}
                onBlur={() => setReplyFocused(false)}
                placeholder={`Reply to ${shortNameFor(author.displayName)}'s story`}
                className="min-w-0 flex-1 rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm text-white placeholder-white/70 outline-none focus:border-white"
              />
              <button
                onClick={handleReply}
                disabled={!replyText.trim()}
                className="shrink-0 text-sm font-semibold disabled:opacity-40"
              >
                Send
              </button>
            </div>
          )}
          <button
            onClick={() => setShowComments(true)}
            aria-label="View comments"
            className="flex w-full items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20"
          >
            <ReplyIcon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-left">Add a comment...</span>
            {commentCount > 0 && <span className="shrink-0 text-xs text-white/50">{commentCount}</span>}
          </button>
        </div>

        {showComments && (
          <div
            className="absolute inset-0 z-10 flex flex-col justify-end bg-black/40"
            onClick={() => setShowComments(false)}
          >
            <div
              className="flex max-h-[70%] flex-col rounded-t-2xl bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <p className="text-sm font-semibold">Comments ({commentCount})</p>
                <button
                  onClick={() => setShowComments(false)}
                  className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
                {commentIds.length > 0 ? (
                  commentIds.map((id) => {
                    const comment = posts[id]
                    if (!comment) return null
                    const commenter = profiles[comment.authorId]
                    if (!commenter) return null
                    const commenterViewable = !isNPC(commenter) || isViewableProfile(commenter)
                    return (
                      <div key={id} className="flex items-start gap-2 py-2">
                        <Avatar avatar={commenter.avatar} seed={commenter.id} size={28} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            {commenterViewable && onOpenProfile ? (
                              <button
                                onClick={() => onOpenProfile(commenter.id)}
                                className="cursor-pointer font-semibold hover:underline"
                              >
                                {commenter.displayName}
                              </button>
                            ) : (
                              <span className="font-semibold">{commenter.displayName}</span>
                            )}{' '}
                            {onOpenProfile ? (
                              <MentionText text={comment.text} onOpenProfile={onOpenProfile} />
                            ) : (
                              comment.text
                            )}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                            <span>{formatRelativeTime(comment.createdAt)}</span>
                            <button onClick={() => handleReplyToComment(id)} className="cursor-pointer font-semibold hover:underline">
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="py-8 text-center text-sm text-neutral-500">No comments yet. Be the first.</p>
                )}
              </div>

              {commentTarget && (
                <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-1.5 text-xs text-neutral-500 dark:border-neutral-800">
                  <span>Replying to @{commentTarget.username}</span>
                  <button
                    onClick={() => {
                      setCommentTarget(null)
                      setCommentText('')
                    }}
                    className="cursor-pointer font-semibold hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className={`flex items-center gap-2 px-4 py-2 ${commentTarget ? '' : 'border-t border-neutral-200 dark:border-neutral-800'}`}>
                {player && <Avatar avatar={player.avatar} seed={player.id} size={28} />}
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value.slice(0, 280))}
                  onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                  placeholder="Add a comment..."
                  className="min-w-0 flex-1 bg-transparent text-sm placeholder-neutral-500 outline-none"
                />
                <button
                  onClick={handleComment}
                  disabled={!commentText.trim()}
                  className="shrink-0 cursor-pointer text-sm font-semibold text-sky-500 disabled:opacity-40"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
