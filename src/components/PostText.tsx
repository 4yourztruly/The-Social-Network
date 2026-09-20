import { memo, useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { buildUsernameIndex } from '../engine/mentions'

interface PostTextProps {
  text: string
  onOpenProfile: (profileId: string) => void
  className?: string
}

// Renders @mentions as clickable links to the mentioned user's profile —
// plain text otherwise. Deliberately not a <p> wrapping <button>s: the
// caller (PostCard) puts this inside a clickable row, and a button can't
// nest inside a button.
function PostTextImpl({ text, onOpenProfile, className }: PostTextProps) {
  const profiles = useGameStore((s) => s.profiles)
  const usernameIndex = useMemo(() => buildUsernameIndex(profiles), [profiles])
  const parts = useMemo(() => text.split(/(@\w+)/g), [text])

  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const id = usernameIndex[part.slice(1).toLowerCase()]
          if (id) {
            return (
              <span
                key={i}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenProfile(id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    onOpenProfile(id)
                  }
                }}
                className="cursor-pointer text-sky-500 hover:underline"
              >
                {part}
              </span>
            )
          }
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

export const PostText = memo(PostTextImpl)
