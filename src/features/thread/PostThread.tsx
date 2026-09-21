import { useMemo, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { PostCard } from '../../components/PostCard'
import { Avatar } from '../../components/Avatar'
import { ArrowLeftIcon } from '../../components/icons'
import { PLAYER_ID } from '../../store/gameStore'

interface PostThreadProps {
  postId: string
  onOpenProfile: (profileId: string) => void
  onBack: () => void
}

export function PostThread({ postId, onOpenProfile, onBack }: PostThreadProps) {
  const post = useGameStore((s) => s.posts[postId])
  const posts = useGameStore((s) => s.posts)
  const postOrder = useGameStore((s) => s.postOrder)
  const player = useGameStore((s) => s.profiles[PLAYER_ID])
  const addPlayerReply = useGameStore((s) => s.addPlayerReply)
  const [replyText, setReplyText] = useState('')

  const replyIds = useMemo(
    () =>
      postOrder
        .filter((id) => posts[id]?.parentId === postId)
        .sort((a, b) => (posts[a]?.createdAt ?? 0) - (posts[b]?.createdAt ?? 0)),
    [postOrder, posts, postId],
  )

  const handleReply = () => {
    if (!replyText.trim()) return
    addPlayerReply(postId, replyText)
    setReplyText('')
  }

  if (!post || !player) return null

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Post</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <PostCard postId={postId} onOpenProfile={onOpenProfile} />
        {replyIds.length > 0 ? (
          replyIds.map((id) => <PostCard key={id} postId={id} onOpenProfile={onOpenProfile} />)
        ) : (
          <p className="p-8 text-center text-sm text-neutral-500">No replies yet. Be the first.</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <Avatar avatar={player.avatar} seed={player.id} size={32} />
        <input
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
