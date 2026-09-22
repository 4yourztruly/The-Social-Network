import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useGameStore } from '../../store/gameStore'
import { PostCard } from '../../components/PostCard'

interface FeedProps {
  onOpenProfile: (profileId: string) => void
  onOpenThread: (postId: string) => void
}

type FeedItem = { type: 'post'; id: string } | { type: 'divider'; day: number }

// "Yesterday" for the day right before today, then the literal in-game Day
// number further back — so scrolling down the feed reads Today -> Yesterday
// -> Day 4 -> Day 3 -> ... making the day boundaries unambiguous.
function dayDividerLabel(day: number, currentDay: number): string {
  const diff = currentDay - day
  return diff === 1 ? 'Yesterday' : `Day ${day}`
}

export function Feed({ onOpenProfile, onOpenThread }: FeedProps) {
  const postOrder = useGameStore((s) => s.postOrder)
  const posts = useGameStore((s) => s.posts)
  const currentDay = useGameStore((s) => s.gameDay)
  // Replies live in the thread view and stories live in the stories row —
  // the top-level timeline is top-level posts only.
  const feedPostIds = useMemo(
    () => postOrder.filter((id) => posts[id]?.kind === 'post'),
    [postOrder, posts],
  )
  // Inserts a divider row wherever consecutive posts (postOrder is already
  // newest-first) cross from one in-game day into an earlier one.
  const items = useMemo<FeedItem[]>(() => {
    const result: FeedItem[] = []
    let lastDay: number | undefined
    for (const id of feedPostIds) {
      const day = posts[id]?.gameDay ?? currentDay
      if (lastDay !== undefined && day !== lastDay) {
        result.push({ type: 'divider', day })
      }
      result.push({ type: 'post', id })
      lastDay = day
    }
    return result
  }, [feedPostIds, posts, currentDay])
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (items[index]?.type === 'divider' ? 36 : 110),
    overscan: 8,
  })

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index]
          return (
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
              {item.type === 'divider' ? (
                <div className="flex items-center gap-3 px-4 py-2">
                  <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {dayDividerLabel(item.day, currentDay)}
                  </span>
                  <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                </div>
              ) : (
                <PostCard postId={item.id} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
              )}
            </div>
          )
        })}
      </div>
      {feedPostIds.length === 0 && (
        <p className="p-8 text-center text-sm text-neutral-500">No posts yet.</p>
      )}
    </div>
  )
}
