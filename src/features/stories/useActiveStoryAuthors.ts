import { useMemo } from 'react'
import { useGameStore, PLAYER_ID } from '../../store/gameStore'

// Author ids with at least one non-expired story, unviewed-first (viewed
// author ids trail, same ordering rule Instagram uses), player's own story
// always leading when present.
export function useActiveStoryAuthors(viewedAuthorIds: ReadonlySet<string>): string[] {
  const posts = useGameStore((s) => s.posts)
  const postOrder = useGameStore((s) => s.postOrder)

  return useMemo(() => {
    const now = Date.now()
    const seen = new Set<string>()
    const order: string[] = []
    for (const id of postOrder) {
      const post = posts[id]
      if (!post || post.kind !== 'story') continue
      if (!post.expiresAt || post.expiresAt <= now) continue
      if (seen.has(post.authorId)) continue
      seen.add(post.authorId)
      order.push(post.authorId)
    }
    return order.sort((a, b) => {
      if (a === PLAYER_ID) return -1
      if (b === PLAYER_ID) return 1
      const aViewed = viewedAuthorIds.has(a) ? 1 : 0
      const bViewed = viewedAuthorIds.has(b) ? 1 : 0
      return aViewed - bViewed
    })
  }, [postOrder, posts, viewedAuthorIds])
}
