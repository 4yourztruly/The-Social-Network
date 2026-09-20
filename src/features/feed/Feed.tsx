import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useGameStore } from '../../store/gameStore'
import { PostCard } from '../../components/PostCard'

interface FeedProps {
  onOpenProfile: (profileId: string) => void
  onOpenThread: (postId: string) => void
}

export function Feed({ onOpenProfile, onOpenThread }: FeedProps) {
  const postOrder = useGameStore((s) => s.postOrder)
  const posts = useGameStore((s) => s.posts)
  // Replies live in the thread view and stories live in the stories row —
  // the top-level timeline is top-level posts only.
  const feedPostIds = useMemo(
    () => postOrder.filter((id) => posts[id]?.kind === 'post'),
    [postOrder, posts],
  )
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: feedPostIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 110,
    overscan: 8,
  })

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${row.start}px)`,
            }}
          >
            <PostCard postId={feedPostIds[row.index]} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
          </div>
        ))}
      </div>
      {feedPostIds.length === 0 && (
        <p className="p-8 text-center text-sm text-neutral-500">No posts yet.</p>
      )}
    </div>
  )
}
