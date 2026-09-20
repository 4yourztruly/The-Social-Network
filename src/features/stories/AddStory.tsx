import { useState } from 'react'
import { useGameStore, PLAYER_ID } from '../../store/gameStore'
import { Avatar } from '../../components/Avatar'
import { gradientCssFor } from '../../components/avatarColors'
import { ArrowLeftIcon } from '../../components/icons'

interface AddStoryProps {
  onBack: () => void
  onPosted: () => void
}

const MAX_LENGTH = 200

export function AddStory({ onBack, onPosted }: AddStoryProps) {
  const player = useGameStore((s) => s.profiles[PLAYER_ID])
  const submitPlayerStory = useGameStore((s) => s.submitPlayerStory)
  const [text, setText] = useState('')

  const handlePost = () => {
    if (!text.trim()) return
    submitPlayerStory(text)
    onPosted()
  }

  if (!player) return null

  return (
    <div className="fixed inset-0 z-[100] flex justify-center bg-black">
      <div
        className="relative flex h-full w-full max-w-xl flex-col text-white"
        style={{ background: gradientCssFor(`story_draft_${player.id}`) }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="rounded-full p-1.5 hover:bg-white/10">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <Avatar avatar={player.avatar} seed={player.id} size={28} />
          <span className="text-sm font-semibold">Your story</span>
          <button
            onClick={handlePost}
            disabled={!text.trim()}
            className="ml-auto rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-neutral-900 disabled:opacity-40"
          >
            Post
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center px-8">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="What's happening right now?"
            className="h-40 w-full resize-none bg-transparent text-center text-2xl font-semibold leading-snug text-white placeholder-white/60 outline-none"
          />
        </div>

        <p className="pb-6 text-center text-xs text-white/60">{text.length}/{MAX_LENGTH} · visible for 24h</p>
      </div>
    </div>
  )
}
