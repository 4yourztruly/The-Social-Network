import { useMemo } from 'react'
import { useGameStore, PLAYER_ID } from '../../store/gameStore'
import { PostCard } from '../../components/PostCard'
import { BellIcon } from '../../components/icons'

interface NotificationsProps {
  onOpenProfile: (profileId: string) => void
  onOpenThread: (postId: string) => void
}

export function Notifications({ onOpenProfile, onOpenThread }: NotificationsProps) {
  const posts = useGameStore((s) => s.posts)
  const postOrder = useGameStore((s) => s.postOrder)

  // Replies to the player's own posts, and any post that tags/mentions the player.
  const mentionIds = useMemo(() => {
    const ownPostIds = new Set(
      postOrder.filter((id) => posts[id]?.authorId === PLAYER_ID),
    )
    return postOrder.filter((id) => {
      const post = posts[id]
      if (!post || post.authorId === PLAYER_ID) return false
      return post.kind === 'reply' && post.parentId && ownPostIds.has(post.parentId)
    })
  }, [posts, postOrder])

  return (
    <div className="h-full overflow-y-auto">
      <h1 className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 px-4 py-3 text-lg font-bold backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
        Notifications
      </h1>
      {mentionIds.length > 0 ? (
        mentionIds.map((id) => (
          <PostCard
            key={id}
            postId={id}
            onOpenProfile={onOpenProfile}
            onOpenThread={() => onOpenThread(posts[id]?.parentId ?? id)}
          />
        ))
      ) : (
        <div className="flex flex-col items-center gap-2 px-8 py-20 text-center">
          <BellIcon className="h-10 w-10 text-neutral-400" />
          <p className="text-sm text-neutral-500">
            Replies and mentions of your posts will show up here.
          </p>
        </div>
      )}
    </div>
  )
}
