import { memo, useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { buildUsernameIndex } from '../engine/mentions'

interface MentionTextProps {
  text: string
  onOpenProfile: (profileId: string) => void
}

// The @mention-highlighting core shared by PostText (wraps it in a <p>, for
// a post/reply body) and any inline caller that needs the same highlighting
// without its own wrapping element (e.g. a comment row that already has a
// name + text on one line).
function MentionTextImpl({ text, onOpenProfile }: MentionTextProps) {
  const profiles = useGameStore((s) => s.profiles)
  const usernameIndex = useMemo(() => buildUsernameIndex(profiles), [profiles])
  const parts = useMemo(() => text.split(/(@\w+)/g), [text])

  return (
    <>
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
                className="cursor-pointer font-medium text-sky-500 hover:underline"
              >
                {part}
              </span>
            )
          }
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export const MentionText = memo(MentionTextImpl)
