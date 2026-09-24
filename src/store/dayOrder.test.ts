import { describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { isNPC } from '../types'

describe('day ordering and story comments', () => {
  it('the tabloid post sits at the bottom of its day, below every other post of that day', async () => {
    await useGameStore.getState().completeOnboarding({
      career: 'footballer', displayName: 'Test', username: 'test', bio: 'Forward.', role: '', org: '', celebs: [{ name: 'Zendaya' }],
    })
    useGameStore.getState().submitPlayerPost({ caption: 'went on a wild night out with friends' })
    const s = useGameStore.getState()
    const day = s.gameDay
    const today = s.postOrder.filter((id) => s.posts[id].kind === 'post' && s.posts[id].gameDay === day)
    const tabloidIds = today.filter((id) => {
      const a = s.profiles[s.posts[id].authorId]
      return a && isNPC(a) && a.persona === 'tabloid'
    })
    if (tabloidIds.length > 0) expect(today.at(-1)).toBe(tabloidIds.at(-1))
  })

  it('no two stories share the exact same comment section', async () => {
    await useGameStore.getState().completeOnboarding({
      career: 'footballer', displayName: 'Test', username: 'test', bio: 'Forward.', role: '', org: '', celebs: [{ name: 'Zendaya' }],
    })
    const posts = Object.values(useGameStore.getState().posts)
    const stories = posts.filter((p) => p.kind === 'story')
    const sections = stories
      .map((st) => posts.filter((p) => p.parentId === st.id).map((p) => p.text).sort().join('|'))
      .filter((x) => x.length > 0)
    expect(new Set(sections).size).toBe(sections.length)
  })
})
