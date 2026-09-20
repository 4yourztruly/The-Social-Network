import { useMemo, useRef, useState } from 'react'
import { useGameStore, PLAYER_ID, type PostOutcome } from '../../store/gameStore'
import { Avatar } from '../../components/Avatar'
import { scanKeywordTags } from '../../engine/keywordTagger'
import { CAREER_PACKS } from '../../content/careers'
import { isNPC } from '../../types'

const MAX_LENGTH = 280
const MAX_SUGGESTIONS = 5

interface ComposeProps {
  onPosted: (outcome: PostOutcome) => void
}

export function Compose({ onPosted }: ComposeProps) {
  const player = useGameStore((s) => s.profiles[PLAYER_ID])
  const career = useGameStore((s) => s.player.career)
  const profiles = useGameStore((s) => s.profiles)
  const submitPlayerPost = useGameStore((s) => s.submitPlayerPost)
  const [caption, setCaption] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const pack = CAREER_PACKS[career]
  const keywordTags = useMemo(() => scanKeywordTags(caption, pack.keywordRules), [caption, pack])

  // Trailing "@partial" right before the caret opens the mention picker —
  // not full cursor-aware rich text, but covers how people actually type
  // mentions (right where they're typing, not mid-sentence edits).
  const mentionQuery = useMemo(() => {
    const before = caption.slice(0, cursorPos)
    const match = /@(\w*)$/.exec(before)
    return match ? match[1] : null
  }, [caption, cursorPos])

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return Object.values(profiles)
      .filter(isNPC)
      .filter((p) => p.username.toLowerCase().startsWith(q) || p.displayName.toLowerCase().startsWith(q))
      .slice(0, MAX_SUGGESTIONS)
  }, [mentionQuery, profiles])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCaption(e.target.value.slice(0, MAX_LENGTH))
    setCursorPos(e.target.selectionStart)
  }

  const insertMention = (username: string) => {
    const before = caption.slice(0, cursorPos)
    const after = caption.slice(cursorPos)
    const newBefore = before.replace(/@(\w*)$/, `@${username} `)
    const next = newBefore + after
    setCaption(next.slice(0, MAX_LENGTH))
    const newCursor = newBefore.length
    setCursorPos(newCursor)
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(newCursor, newCursor)
      textareaRef.current?.focus()
    })
  }

  const handlePost = () => {
    if (!caption.trim()) return
    const outcome = submitPlayerPost({ caption })
    setCaption('')
    onPosted(outcome)
  }

  if (!player) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h1 className="text-lg font-bold">New post</h1>
        <button
          onClick={handlePost}
          disabled={!caption.trim()}
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          Post
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-3 px-4 py-3">
          <Avatar avatar={player.avatar} seed={player.id} />
          <textarea
            ref={textareaRef}
            autoFocus
            value={caption}
            onChange={handleChange}
            onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart)}
            onClick={(e) => setCursorPos(e.currentTarget.selectionStart)}
            placeholder="What's happening? Use @ to mention someone."
            className="min-h-28 flex-1 resize-none bg-transparent text-[17px] leading-snug placeholder-neutral-500 outline-none"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="mx-4 mb-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            {suggestions.map((npc) => (
              <button
                key={npc.id}
                onClick={() => insertMention(npc.username)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Avatar avatar={npc.avatar} seed={npc.id} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{npc.displayName}</span>
                  <span className="block truncate text-xs text-neutral-500">@{npc.username}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {keywordTags.length > 0 && (
          <div className="px-4 pb-3">
            <p className="mb-1.5 text-xs font-semibold text-neutral-500">Detected tags</p>
            <div className="flex flex-wrap gap-1.5">
              {keywordTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  #{tag.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-200 px-4 py-2 text-right text-xs text-neutral-500 dark:border-neutral-800">
        {caption.length}/{MAX_LENGTH}
      </div>
    </div>
  )
}
