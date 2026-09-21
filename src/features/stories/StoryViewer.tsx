import { useEffect, useMemo, useState } from 'react'
import { useGameStore, PLAYER_ID } from '../../store/gameStore'
import { isNPC } from '../../types'
import { isDmAvailable } from '../../engine/npcTier'
import { Avatar } from '../../components/Avatar'
import { gradientCssFor } from '../../components/avatarColors'
import { shortNameFor } from '../../components/shortName'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { formatRelativeTime } from '../../engine/time'
import { useActiveStoryAuthors } from './useActiveStoryAuthors'

const STORY_DURATION_MS = 5000

interface StoryViewerProps {
  authorId: string
  viewedAuthorIds: ReadonlySet<string>
  onMarkViewed: (authorId: string) => void
  onChangeAuthor: (authorId: string) => void
  onClose: () => void
}

export function StoryViewer({ authorId, viewedAuthorIds, onMarkViewed, onChangeAuthor, onClose }: StoryViewerProps) {
  const posts = useGameStore((s) => s.posts)
  const postOrder = useGameStore((s) => s.postOrder)
  const profiles = useGameStore((s) => s.profiles)
  const sendPlayerMessage = useGameStore((s) => s.sendPlayerMessage)
  const authorIds = useActiveStoryAuthors(viewedAuthorIds)
  const [storyIndex, setStoryIndex] = useState(0)
  const [replyText, setReplyText] = useState('')

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

  useEffect(() => {
    setStoryIndex(0)
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
    const nextAuthor = authorIds[authorPos + 1]
    if (nextAuthor) onChangeAuthor(nextAuthor)
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

  useEffect(() => {
    // Don't advance out from under a reply the player is mid-typing — that
    // would silently redirect their message to whoever's story comes next.
    if (!story || replyText.length > 0) return
    const timer = setTimeout(goNext, STORY_DURATION_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId, storyIndex, story, replyText.length > 0])

  const handleReply = () => {
    if (!replyText.trim() || authorId === PLAYER_ID) return
    sendPlayerMessage(authorId, replyText)
    setReplyText('')
  }

  if (!author || !story) return null

  return (
    <div className="fixed inset-0 z-[100] flex justify-center bg-black">
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
                      ? { width: '100%', animation: `story-progress ${STORY_DURATION_MS}ms linear forwards` }
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
          <button aria-label="Previous" onClick={goPrev} className="absolute inset-y-0 left-0 w-1/3" />
          <button aria-label="Next" onClick={goNext} className="absolute inset-y-0 right-0 w-1/3" />
          <p className="text-center text-2xl font-semibold leading-snug drop-shadow">{story.text}</p>
        </div>

        {authorId !== PLAYER_ID && isNPC(author) && isDmAvailable(author) && (
          <div className="flex items-center gap-2 px-3 pb-4">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, 280))}
              onKeyDown={(e) => e.key === 'Enter' && handleReply()}
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
      </div>
    </div>
  )
}
