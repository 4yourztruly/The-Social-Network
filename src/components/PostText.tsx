import { memo } from 'react'
import { MentionText } from './MentionText'

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
  return (
    <p className={className}>
      <MentionText text={text} onOpenProfile={onOpenProfile} />
    </p>
  )
}

export const PostText = memo(PostTextImpl)
